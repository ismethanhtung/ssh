use anyhow::Result;
use russh::*;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tokio::io::{AsyncWriteExt};
use tokio::sync::{mpsc, Mutex, RwLock};
use tokio::time::{timeout, Duration};

/// Enhanced PTY session with proper resource management and error handling
pub struct PtySession {
    pub input_tx: mpsc::Sender<Vec<u8>>,
    pub output_rx: Arc<Mutex<mpsc::Receiver<Vec<u8>>>>,
    pub channel_id: ChannelId,
    
    // Resource management
    is_closed: Arc<AtomicBool>,
    input_task: Arc<Mutex<Option<tokio::task::JoinHandle<()>>>>,
    output_task: Arc<Mutex<Option<tokio::task::JoinHandle<()>>>>,
    
    // Terminal state
    terminal_size: Arc<RwLock<(u32, u32)>>, // (cols, rows)
}

impl PtySession {
    /// Create a new PTY session with enhanced safety features
    pub async fn create(
        session: &Arc<client::Handle<super::Client>>,
        cols: u32,
        rows: u32,
    ) -> Result<Self> {
        // Validate terminal size
        if cols == 0 || rows == 0 || cols > 1000 || rows > 1000 {
            return Err(anyhow::anyhow!(
                "Invalid terminal size: {}x{}. Must be between 1-1000",
                cols, rows
            ));
        }

        // Open a new SSH channel with timeout
        let channel = timeout(
            Duration::from_secs(10),
            session.channel_open_session()
        )
        .await
        .map_err(|_| anyhow::anyhow!("Timeout opening SSH channel"))?
        .map_err(|e| anyhow::anyhow!("Failed to open SSH channel: {}", e))?;
        
        // Request PTY with timeout
        timeout(
            Duration::from_secs(5),
            channel.request_pty(
                true,
                "xterm-256color",
                cols,
                rows,
                0,
                0,
                &[],
            )
        )
        .await
        .map_err(|_| anyhow::anyhow!("Timeout requesting PTY"))?
        .map_err(|e| anyhow::anyhow!("Failed to request PTY: {}", e))?;
        
        // Start interactive shell with timeout
        timeout(
            Duration::from_secs(5),
            channel.request_shell(true)
        )
        .await
        .map_err(|_| anyhow::anyhow!("Timeout starting shell"))?
        .map_err(|e| anyhow::anyhow!("Failed to start shell: {}", e))?;
        
        // Create channels with appropriate capacity
        // Input: smaller buffer (user typing is slow)
        // Output: larger buffer (program output can be fast)
        let (input_tx, input_rx) = mpsc::channel::<Vec<u8>>(1000);
        let (output_tx, output_rx) = mpsc::channel::<Vec<u8>>(2000);
        
        let channel_id = channel.id();
        let is_closed = Arc::new(AtomicBool::new(false));
        let terminal_size = Arc::new(RwLock::new((cols, rows)));
        
        // Spawn input task with proper error handling
        let input_task = Self::spawn_input_task(
            channel.make_writer(),
            input_rx,
            is_closed.clone(),
        );
        
        // Spawn output task with proper error handling
        let output_task = Self::spawn_output_task(
            channel,
            output_tx,
            is_closed.clone(),
        );
        
        Ok(Self {
            input_tx,
            output_rx: Arc::new(Mutex::new(output_rx)),
            channel_id,
            is_closed,
            input_task: Arc::new(Mutex::new(Some(input_task))),
            output_task: Arc::new(Mutex::new(Some(output_task))),
            terminal_size,
        })
    }
    
    /// Spawn task to handle input (frontend → SSH)
    fn spawn_input_task(
        mut writer: impl AsyncWriteExt + Unpin + Send + 'static,
        mut input_rx: mpsc::Receiver<Vec<u8>>,
        is_closed: Arc<AtomicBool>,
    ) -> tokio::task::JoinHandle<()> {
        tokio::spawn(async move {
            while let Some(data) = input_rx.recv().await {
                // Check if session is closed
                if is_closed.load(Ordering::Relaxed) {
                    tracing::debug!("[PTY Input] Session closed, stopping input task");
                    break;
                }
                
                // Write with timeout to prevent hanging
                match timeout(Duration::from_secs(5), writer.write_all(&data)).await {
                    Ok(Ok(_)) => {
                        // Flush immediately for responsiveness
                        if let Err(e) = timeout(Duration::from_secs(1), writer.flush()).await {
                            tracing::error!("[PTY Input] Flush timeout: {}", e);
                            break;
                        }
                    }
                    Ok(Err(e)) => {
                        tracing::error!("[PTY Input] Write error: {}", e);
                        break;
                    }
                    Err(_) => {
                        tracing::error!("[PTY Input] Write timeout");
                        break;
                    }
                }
            }
            
            is_closed.store(true, Ordering::Relaxed);
            tracing::debug!("[PTY Input] Task terminated");
        })
    }
    
    /// Spawn task to handle output (SSH → frontend)
    fn spawn_output_task(
        mut channel: Channel<client::Msg>,
        output_tx: mpsc::Sender<Vec<u8>>,
        is_closed: Arc<AtomicBool>,
    ) -> tokio::task::JoinHandle<()> {
        tokio::spawn(async move {
            loop {
                // Check if session is closed
                if is_closed.load(Ordering::Relaxed) {
                    tracing::debug!("[PTY Output] Session closed, stopping output task");
                    break;
                }
                
                // Wait for channel message with timeout
                let msg = match timeout(Duration::from_millis(100), channel.wait()).await {
                    Ok(Some(msg)) => msg,
                    Ok(None) => {
                        tracing::debug!("[PTY Output] Channel closed");
                        break;
                    }
                    Err(_) => {
                        // Timeout - continue loop to check is_closed flag
                        continue;
                    }
                };
                
                match msg {
                    ChannelMsg::Data { data } => {
                        // Send with timeout to prevent blocking
                        match timeout(Duration::from_secs(5), output_tx.send(data.to_vec())).await {
                            Ok(Ok(_)) => {}
                            Ok(Err(_)) => {
                                tracing::error!("[PTY Output] Output channel closed");
                                break;
                            }
                            Err(_) => {
                                tracing::error!("[PTY Output] Send timeout");
                                break;
                            }
                        }
                    }
                    ChannelMsg::ExtendedData { data, .. } => {
                        // stderr data
                        if timeout(Duration::from_secs(5), output_tx.send(data.to_vec())).await.is_err() {
                            break;
                        }
                    }
                    ChannelMsg::Eof | ChannelMsg::Close => {
                        tracing::debug!("[PTY Output] Channel EOF/Close received");
                        break;
                    }
                    ChannelMsg::ExitStatus { exit_status } => {
                        tracing::debug!("[PTY Output] Process exited with status: {}", exit_status);
                        // Continue to drain remaining output
                    }
                    _ => {}
                }
            }
            
            is_closed.store(true, Ordering::Relaxed);
            tracing::debug!("[PTY Output] Task terminated");
        })
    }
    
    /// Check if session is closed
    pub fn is_closed(&self) -> bool {
        self.is_closed.load(Ordering::Relaxed)
    }
    
    /// Get current terminal size
    #[allow(dead_code)]
    pub async fn get_size(&self) -> (u32, u32) {
        *self.terminal_size.read().await
    }
    
    /// Update terminal size (for resize operations)
    pub async fn update_size(&self, cols: u32, rows: u32) -> Result<()> {
        // Validate size
        if cols == 0 || rows == 0 || cols > 1000 || rows > 1000 {
            return Err(anyhow::anyhow!(
                "Invalid terminal size: {}x{}",
                cols, rows
            ));
        }
        
        let mut size = self.terminal_size.write().await;
        *size = (cols, rows);
        Ok(())
    }
    
    /// Write data to PTY with safety checks
    pub async fn write(&self, data: Vec<u8>) -> Result<()> {
        if self.is_closed() {
            return Err(anyhow::anyhow!("PTY session is closed"));
        }
        
        if data.is_empty() {
            return Ok(());
        }
        
        // Limit data size to prevent memory issues
        if data.len() > 1_000_000 {
            return Err(anyhow::anyhow!(
                "Data too large: {} bytes (max 1MB)",
                data.len()
            ));
        }
        
        // Try non-blocking send first
        match self.input_tx.try_send(data.clone()) {
            Ok(_) => Ok(()),
            Err(mpsc::error::TrySendError::Full(data)) => {
                // Channel full, try with timeout
                timeout(Duration::from_secs(5), self.input_tx.send(data))
                    .await
                    .map_err(|_| anyhow::anyhow!("Write timeout: input buffer full"))?
                    .map_err(|_| anyhow::anyhow!("PTY input channel closed"))?;
                Ok(())
            }
            Err(mpsc::error::TrySendError::Closed(_)) => {
                Err(anyhow::anyhow!("PTY input channel closed"))
            }
        }
    }
    
    /// Read data from PTY with timeout
    pub async fn read(&self, timeout_ms: u64) -> Result<Vec<u8>> {
        if self.is_closed() {
            return Err(anyhow::anyhow!("PTY session is closed"));
        }
        
        let mut rx = self.output_rx.lock().await;
        
        // Try immediate read first
        match rx.try_recv() {
            Ok(data) => return Ok(data),
            Err(mpsc::error::TryRecvError::Empty) => {
                // No immediate data, wait with timeout
            }
            Err(mpsc::error::TryRecvError::Disconnected) => {
                return Err(anyhow::anyhow!("PTY output channel closed"));
            }
        }
        
        // Wait with timeout
        match timeout(Duration::from_millis(timeout_ms), rx.recv()).await {
            Ok(Some(data)) => Ok(data),
            Ok(None) => Err(anyhow::anyhow!("PTY output channel closed")),
            Err(_) => Ok(Vec::new()), // Timeout - no data available
        }
    }
    
    /// Gracefully close the PTY session
    pub async fn close(&self) {
        if self.is_closed.swap(true, Ordering::Relaxed) {
            // Already closed
            return;
        }
        
        tracing::debug!("[PTY] Closing session {}", self.channel_id);
        
        // Abort tasks with timeout
        let mut input_task = self.input_task.lock().await;
        if let Some(task) = input_task.take() {
            task.abort();
            // Wait for task to finish with timeout
            let _ = timeout(Duration::from_secs(2), task).await;
        }
        
        let mut output_task = self.output_task.lock().await;
        if let Some(task) = output_task.take() {
            task.abort();
            let _ = timeout(Duration::from_secs(2), task).await;
        }
        
        tracing::debug!("[PTY] Session {} closed", self.channel_id);
    }
}

impl Drop for PtySession {
    fn drop(&mut self) {
        // Mark as closed
        self.is_closed.store(true, Ordering::Relaxed);
        
        // Abort tasks (they will be cleaned up by tokio runtime)
        if let Ok(mut input_task) = self.input_task.try_lock() {
            if let Some(task) = input_task.take() {
                task.abort();
            }
        }
        
        if let Ok(mut output_task) = self.output_task.try_lock() {
            if let Some(task) = output_task.take() {
                task.abort();
            }
        }
        
        tracing::debug!("[PTY] Session {} dropped", self.channel_id);
    }
}
