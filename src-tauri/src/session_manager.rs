use crate::ssh::{PtySession, SshClient, SshConfig};
use anyhow::Result;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio_util::sync::CancellationToken;

pub struct SessionManager {
    sessions: Arc<RwLock<HashMap<String, Arc<RwLock<SshClient>>>>>,
    pub pty_sessions: Arc<RwLock<HashMap<String, Arc<PtySession>>>>,
    pending_connections: Arc<RwLock<HashMap<String, CancellationToken>>>,
}

impl SessionManager {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(RwLock::new(HashMap::new())),
            pty_sessions: Arc::new(RwLock::new(HashMap::new())),
            pending_connections: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn create_session(&self, session_id: String, config: SshConfig) -> Result<()> {
        // Close existing session with same ID if it exists to release resources (like forwarded ports)
        if let Err(e) = self.close_session(&session_id).await {
            tracing::debug!("No existing session to close for {}: {}", session_id, e);
        }

        let mut client = SshClient::new();
        let cancel_token = self.register_pending_connection(&session_id).await;

        let connect_result = tokio::select! {
            res = client.connect(&config) => res,
            _ = cancel_token.cancelled() => Err(anyhow::anyhow!("Connection cancelled by user")),
        };

        self.clear_pending_connection(&session_id).await;

        connect_result?;
        
        let mut sessions = self.sessions.write().await;
        sessions.insert(session_id, Arc::new(RwLock::new(client)));
        
        Ok(())
    }

    async fn register_pending_connection(&self, session_id: &str) -> CancellationToken {
        let token = CancellationToken::new();
        let mut pending = self.pending_connections.write().await;
        pending.insert(session_id.to_string(), token.clone());
        token
    }

    async fn clear_pending_connection(&self, session_id: &str) {
        let mut pending = self.pending_connections.write().await;
        pending.remove(session_id);
    }

    pub async fn cancel_pending_connection(&self, session_id: &str) -> bool {
        let mut pending = self.pending_connections.write().await;
        if let Some(token) = pending.remove(session_id) {
            token.cancel();
            true
        } else {
            false
        }
    }

    pub async fn get_session(&self, session_id: &str) -> Option<Arc<RwLock<SshClient>>> {
        let sessions = self.sessions.read().await;
        sessions.get(session_id).cloned()
    }

    pub async fn close_session(&self, session_id: &str) -> Result<()> {
        // First close any PTY sessions for this SSH session
        if let Err(e) = self.close_pty_session(session_id).await {
            tracing::debug!("No PTY session to close for {}: {}", session_id, e);
        }

        let mut sessions = self.sessions.write().await;
        if let Some(client) = sessions.remove(session_id) {
            let mut client = client.write().await;
            client.disconnect().await?;
        }
        Ok(())
    }

    pub async fn list_sessions(&self) -> Vec<String> {
        let sessions = self.sessions.read().await;
        sessions.keys().cloned().collect()
    }

    // ===== PTY Session Management (Interactive Terminal) =====
    
    /// Start a PTY shell session (like ttyd does)
    /// Enables interactive commands: vim, less, more, top, htop, etc.
    pub async fn start_pty_session(
        &self,
        session_id: &str,
        cols: u32,
        rows: u32,
    ) -> Result<()> {
        // Get the SSH client
        let sessions = self.sessions.read().await;
        let client = sessions
            .get(session_id)
            .ok_or_else(|| anyhow::anyhow!("Session not found"))?;
        
        let client = client.read().await;
        
        // Create PTY session
        let pty = client.create_pty_session(cols, rows).await?;
        
        // Store PTY session
        let mut pty_sessions = self.pty_sessions.write().await;
        pty_sessions.insert(session_id.to_string(), Arc::new(pty));
        
        Ok(())
    }
    
    /// Send data to PTY (user input)
    /// Uses enhanced PTY session's safe write method with timeout and validation
    pub async fn write_to_pty(
        &self,
        session_id: &str,
        data: Vec<u8>,
    ) -> Result<()> {
        // First check if SSH session exists (PTY requires SSH session)
        let sessions = self.sessions.read().await;
        if !sessions.contains_key(session_id) {
            return Err(anyhow::anyhow!("SSH session not found: {}", session_id));
        }
        drop(sessions); // Release lock before acquiring pty_sessions lock
        
        let pty_sessions = self.pty_sessions.read().await;
        let pty = pty_sessions
            .get(session_id)
            .ok_or_else(|| anyhow::anyhow!("PTY session not found: {}", session_id))?;
        
        // Use the enhanced PTY session's safe write method
        // This includes timeout, size validation, and proper error handling
        pty.write(data).await
    }
    
    /// Read data from PTY (output for display)
    /// Uses enhanced PTY session's safe read method with timeout
    pub async fn read_from_pty(
        &self,
        session_id: &str,
    ) -> Result<Vec<u8>> {
        // First check if SSH session exists (PTY requires SSH session)
        let sessions = self.sessions.read().await;
        if !sessions.contains_key(session_id) {
            return Err(anyhow::anyhow!("SSH session not found: {}", session_id));
        }
        drop(sessions); // Release lock before acquiring pty_sessions lock
        
        let pty_sessions = self.pty_sessions.read().await;
        let pty = pty_sessions
            .get(session_id)
            .ok_or_else(|| anyhow::anyhow!("PTY session not found: {}", session_id))?;
        
        // Use the enhanced PTY session's safe read method
        // 1ms timeout for ultra-low latency
        pty.read(1).await
    }
    
    /// Close PTY session with proper cleanup
    pub async fn close_pty_session(&self, session_id: &str) -> Result<()> {
        let mut pty_sessions = self.pty_sessions.write().await;
        
        // Get the PTY session and close it gracefully
        if let Some(pty) = pty_sessions.get(session_id) {
            tracing::info!("Closing PTY session: {}", session_id);
            pty.close().await;
        }
        
        // Remove from map
        pty_sessions.remove(session_id);
        Ok(())
    }
}
