use crate::session_manager::SessionManager;
use crate::ssh::{AuthMethod, ForwardPort, SshConfig};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::State;

#[derive(Debug, Serialize, Deserialize)]
pub struct ConnectRequest {
    pub session_id: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_method: String,
    pub password: Option<String>,
    pub key_path: Option<String>,
    pub passphrase: Option<String>,
    pub forward_ports: Option<Vec<ForwardPort>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MemoryStats {
    pub total: u64,
    pub used: u64,
    pub free: u64,
    pub available: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DiskStats {
    pub total: String,
    pub used: String,
    pub available: String,
    pub use_percent: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CpuStats {
    pub total_percent: f64,
    pub user_percent: f64,
    pub system_percent: f64,
    pub iowait_percent: f64,
    pub cores: u32,
    pub load_average_1m: f64,
    pub load_average_5m: f64,
    pub load_average_15m: f64,
}

#[derive(Debug, Serialize)]
pub struct SystemStats {
    pub cpu_percent: f64,
    pub cpu_details: CpuStats,
    pub memory: MemoryStats,
    pub swap: MemoryStats,
    pub disk: DiskStats,
    pub uptime: String,
    pub load_average: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SystemStatsResponse {
    pub success: bool,
    pub stats: SystemStats,
    pub error: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct CommandResponse {
    pub success: bool,
    pub output: Option<String>,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn ssh_connect(
    request: ConnectRequest,
    state: State<'_, Arc<SessionManager>>,
) -> Result<CommandResponse, String> {
    let auth_method = match request.auth_method.as_str() {
        "password" => AuthMethod::Password {
            password: request.password.ok_or("Password required")?,
        },
        "publickey" => AuthMethod::PublicKey {
            key_path: request.key_path.ok_or("Key path required")?,
            passphrase: request.passphrase,
        },
        _ => return Err("Invalid auth method".to_string()),
    };

    let config = SshConfig {
        host: request.host,
        port: request.port,
        username: request.username,
        auth_method,
        forward_ports: request.forward_ports,
    };

    match state.create_session(request.session_id.clone(), config).await {
        Ok(_) => Ok(CommandResponse {
            success: true,
            output: Some(format!("Connected: {}", request.session_id)),
            error: None,
        }),
        Err(e) => Ok(CommandResponse {
            success: false,
            output: None,
            error: Some(e.to_string()),
        }),
    }
}

#[tauri::command]
pub async fn ssh_cancel_connect(
    session_id: String,
    state: State<'_, Arc<SessionManager>>,
) -> Result<CommandResponse, String> {
    if state.cancel_pending_connection(&session_id).await {
        Ok(CommandResponse {
            success: true,
            output: Some("Connection cancelled".to_string()),
            error: None,
        })
    } else {
        Ok(CommandResponse {
            success: false,
            output: None,
            error: Some("No pending connection to cancel".to_string()),
        })
    }
}

#[tauri::command]
pub async fn ssh_disconnect(
    session_id: String,
    state: State<'_, Arc<SessionManager>>,
) -> Result<CommandResponse, String> {
    match state.close_session(&session_id).await {
        Ok(_) => Ok(CommandResponse {
            success: true,
            output: Some("Disconnected".to_string()),
            error: None,
        }),
        Err(e) => Ok(CommandResponse {
            success: false,
            output: None,
            error: Some(e.to_string()),
        }),
    }
}

#[tauri::command]
pub async fn ssh_execute_command(
    session_id: String,
    command: String,
    state: State<'_, Arc<SessionManager>>,
) -> Result<CommandResponse, String> {
    let session = state
        .get_session(&session_id)
        .await
        .ok_or("Session not found")?;

    let client = session.read().await;
    
    // Transform interactive commands to batch mode
    let transformed_command = transform_interactive_command(&command);
    
    match client.execute_command(&transformed_command).await {
        Ok(output) => Ok(CommandResponse {
            success: true,
            output: Some(output),
            error: None,
        }),
        Err(e) => {
            // Check if it's an interactive command that failed
            let error_msg = if is_interactive_command(&command) {
                format!("{}\n\nNote: Interactive commands like '{}' may not work in this terminal. Try using batch mode alternatives.", 
                    e, 
                    get_command_name(&command))
            } else {
                e.to_string()
            };
            
            Ok(CommandResponse {
                success: false,
                output: None,
                error: Some(error_msg),
            })
        }
    }
}

// Helper function to transform interactive commands to batch mode
fn transform_interactive_command(command: &str) -> String {
    let cmd = command.trim();
    
    // Handle 'top' - convert to batch mode with 1 iteration
    if cmd == "top" || cmd.starts_with("top ") {
        return format!("{} -bn1", cmd);
    }
    
    // Handle 'htop' - suggest alternative
    if cmd == "htop" || cmd.starts_with("htop ") {
        return "top -bn1".to_string();
    }
    
    // Return original command if no transformation needed
    command.to_string()
}

// Helper function to check if a command is interactive
fn is_interactive_command(command: &str) -> bool {
    let cmd_name = get_command_name(command);
    matches!(cmd_name.as_str(), 
        "top" | "htop" | "vim" | "vi" | "nano" | "emacs" | 
        "less" | "more" | "man" | "tmux" | "screen"
    )
}

// Helper function to extract command name
fn get_command_name(command: &str) -> String {
    command
        .split_whitespace()
        .next()
        .unwrap_or("")
        .to_string()
}

#[tauri::command]
pub async fn get_system_stats(
    session_id: String,
    state: State<'_, Arc<SessionManager>>,
) -> Result<SystemStatsResponse, String> {
    let session = state
        .get_session(&session_id)
        .await
        .ok_or("Session not found")?;

    let client = session.read().await;

    // Combined CPU command - get all CPU info in one call
    let cpu_combined_cmd = "echo \"$(top -bn1 | grep 'Cpu(s)' | sed 's/%//g' | awk '{print $2,$4,$10}') $(uptime | awk -F'load average:' '{print $2}' | xargs) $(nproc --all 2>/dev/null || grep -c '^processor' /proc/cpuinfo || sysctl -n hw.ncpu 2>/dev/null || echo '1')\"";
    let cpu_combined_output = client.execute_command(cpu_combined_cmd).await.unwrap_or_default();
    let cpu_parts: Vec<&str> = cpu_combined_output.split_whitespace().collect();

    // Parse CPU stats from combined output
    let user_percent = cpu_parts.first().and_then(|s| s.parse().ok()).unwrap_or(0.0);
    let system_percent = cpu_parts.get(1).and_then(|s| s.parse().ok()).unwrap_or(0.0);
    let iowait_percent = cpu_parts.get(2).and_then(|s| s.parse().ok()).unwrap_or(0.0);

    // Load average values
    let load_1m = cpu_parts.get(3).and_then(|s| s.trim_end_matches(',').parse().ok()).unwrap_or(0.0);
    let load_5m = cpu_parts.get(4).and_then(|s| s.trim_end_matches(',').parse().ok()).unwrap_or(0.0);
    let load_15m = cpu_parts.get(5).and_then(|s| s.trim_end_matches(',').parse().ok()).unwrap_or(0.0);

    // CPU cores
    let cores = cpu_parts.get(6).and_then(|s| s.parse().ok()).unwrap_or(1);

    // Calculate total CPU percent
    let cpu_percent = user_percent + system_percent + iowait_percent;

    // Load average values already parsed above

    let cpu_details = CpuStats {
        total_percent: cpu_percent,
        user_percent,
        system_percent,
        iowait_percent,
        cores,
        load_average_1m: load_1m,
        load_average_5m: load_5m,
        load_average_15m: load_15m,
    };

    // Combined memory, swap, disk, and uptime command
    let combined_cmd = "echo \"$(free -m | awk 'NR==2{printf \"%s %s %s %s \", $2,$3,$4,$7} NR==3{printf \"%s %s %s \", $2,$3,$4}') $(df -h / | awk 'NR==2{printf \"%s %s %s %s\", $2,$3,$4,$5}')\" && (uptime -p 2>/dev/null || uptime | awk '{print $3\" \"$4}')";
    let combined_output = client.execute_command(combined_cmd).await.unwrap_or_default();
    let combined_parts: Vec<&str> = combined_output.trim().split_whitespace().collect();

    // Parse memory stats (first 4 values)
    let memory = MemoryStats {
        total: combined_parts.first().and_then(|s| s.parse().ok()).unwrap_or(0),
        used: combined_parts.get(1).and_then(|s| s.parse().ok()).unwrap_or(0),
        free: combined_parts.get(2).and_then(|s| s.parse().ok()).unwrap_or(0),
        available: combined_parts.get(3).and_then(|s| s.parse().ok()).unwrap_or(0),
    };

    // Parse swap stats (next 3 values)
    let swap = MemoryStats {
        total: combined_parts.get(4).and_then(|s| s.parse().ok()).unwrap_or(0),
        used: combined_parts.get(5).and_then(|s| s.parse().ok()).unwrap_or(0),
        free: combined_parts.get(6).and_then(|s| s.parse().ok()).unwrap_or(0),
        available: 0, // Swap doesn't have 'available' concept
    };

    // Parse disk stats (next 4 values)
    let disk = DiskStats {
        total: combined_parts.get(7).unwrap_or(&"0").to_string(),
        used: combined_parts.get(8).unwrap_or(&"0").to_string(),
        available: combined_parts.get(9).unwrap_or(&"0").to_string(),
        use_percent: combined_parts
            .get(10)
            .and_then(|s| s.trim_end_matches('%').parse().ok())
            .unwrap_or(0.0),
    };

    // Parse uptime (remaining parts)
    let uptime_parts = &combined_parts[11..];
    let uptime = if uptime_parts.len() > 0 {
        uptime_parts.join(" ")
    } else {
        "Unknown".to_string()
    };

    // Load average
    let load_cmd = "uptime | awk -F'load average:' '{print $2}' | xargs";
    let load_average = client
        .execute_command(load_cmd)
        .await
        .ok()
        .map(|s| s.trim().to_string());

    Ok(SystemStatsResponse {
        success: true,
        stats: SystemStats {
            cpu_percent,
            cpu_details,
            memory,
            swap,
            disk,
            uptime,
            load_average,
        },
        error: None,
    })
}

#[tauri::command]
pub async fn list_files(
    session_id: String,
    path: String,
    state: State<'_, Arc<SessionManager>>,
) -> Result<String, String> {
    let session = state
        .get_session(&session_id)
        .await
        .ok_or("Session not found")?;

    let client = session.read().await;
    let command = format!("ls -la --time-style=long-iso '{}'", path);
    
    match client.execute_command(&command).await {
        Ok(output) => Ok(output),
        Err(e) => Err(e.to_string()),
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileTransferRequest {
    pub session_id: String,
    pub local_path: String,
    pub remote_path: String,
    pub data: Option<Vec<u8>>, // For upload: file contents
}

#[derive(Debug, Serialize)]
pub struct FileTransferResponse {
    pub success: bool,
    pub bytes_transferred: Option<u64>,
    pub data: Option<Vec<u8>>, // For download: file contents
    pub error: Option<String>,
}

#[tauri::command]
pub async fn sftp_download_file(
    request: FileTransferRequest,
    state: State<'_, Arc<SessionManager>>,
) -> Result<FileTransferResponse, String> {
    let session = state
        .get_session(&request.session_id)
        .await
        .ok_or("Session not found")?;

    let client = session.read().await;
    
    // If local_path is empty, download to memory (for browser download)
    if request.local_path.is_empty() {
        match client.download_file_to_memory(&request.remote_path).await {
            Ok(data) => {
                let bytes = data.len() as u64;
                Ok(FileTransferResponse {
                    success: true,
                    bytes_transferred: Some(bytes),
                    data: Some(data),
                    error: None,
                })
            },
            Err(e) => Ok(FileTransferResponse {
                success: false,
                bytes_transferred: None,
                data: None,
                error: Some(e.to_string()),
            }),
        }
    } else {
        // Download to local file
        match client.download_file(&request.remote_path, &request.local_path).await {
            Ok(bytes) => Ok(FileTransferResponse {
                success: true,
                bytes_transferred: Some(bytes),
                data: None,
                error: None,
            }),
            Err(e) => Ok(FileTransferResponse {
                success: false,
                bytes_transferred: None,
                data: None,
                error: Some(e.to_string()),
            }),
        }
    }
}

#[tauri::command]
pub async fn sftp_upload_file(
    request: FileTransferRequest,
    state: State<'_, Arc<SessionManager>>,
) -> Result<FileTransferResponse, String> {
    let session = state
        .get_session(&request.session_id)
        .await
        .ok_or("Session not found")?;

    let client = session.read().await;
    
    // If data is provided, write directly; otherwise read from local_path
    let result = if let Some(data) = &request.data {
        client.upload_file_from_bytes(data, &request.remote_path).await
    } else {
        client.upload_file(&request.local_path, &request.remote_path).await
    };
    
    match result {
        Ok(bytes) => Ok(FileTransferResponse {
            success: true,
            bytes_transferred: Some(bytes),
            data: None,
            error: None,
        }),
        Err(e) => Ok(FileTransferResponse {
            success: false,
            bytes_transferred: None,
            data: None,
            error: Some(e.to_string()),
        }),
    }
}

// File operation commands
#[tauri::command]
pub async fn create_directory(
    session_id: String,
    path: String,
    state: State<'_, Arc<SessionManager>>,
) -> Result<bool, String> {
    let session = state
        .get_session(&session_id)
        .await
        .ok_or("Session not found")?;

    let client = session.read().await;
    let command = format!("mkdir -p '{}'", path);
    
    match client.execute_command(&command).await {
        Ok(_) => Ok(true),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub async fn delete_file(
    session_id: String,
    path: String,
    is_directory: bool,
    state: State<'_, Arc<SessionManager>>,
) -> Result<bool, String> {
    let session = state
        .get_session(&session_id)
        .await
        .ok_or("Session not found")?;

    let client = session.read().await;
    let command = if is_directory {
        format!("rm -rf '{}'", path)
    } else {
        format!("rm -f '{}'", path)
    };
    
    match client.execute_command(&command).await {
        Ok(_) => Ok(true),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub async fn rename_file(
    session_id: String,
    old_path: String,
    new_path: String,
    state: State<'_, Arc<SessionManager>>,
) -> Result<bool, String> {
    let session = state
        .get_session(&session_id)
        .await
        .ok_or("Session not found")?;

    let client = session.read().await;
    let command = format!("mv '{}' '{}'", old_path, new_path);
    
    match client.execute_command(&command).await {
        Ok(_) => Ok(true),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub async fn create_file(
    session_id: String,
    path: String,
    content: String,
    state: State<'_, Arc<SessionManager>>,
) -> Result<bool, String> {
    let session = state
        .get_session(&session_id)
        .await
        .ok_or("Session not found")?;

    let client = session.read().await;
    
    // Upload the content as bytes
    match client.upload_file_from_bytes(content.as_bytes(), &path).await {
        Ok(_) => Ok(true),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub async fn read_file_content(
    session_id: String,
    path: String,
    state: State<'_, Arc<SessionManager>>,
) -> Result<String, String> {
    let session = state
        .get_session(&session_id)
        .await
        .ok_or("Session not found")?;

    let client = session.read().await;
    let command = format!("cat '{}'", path);
    
    match client.execute_command(&command).await {
        Ok(output) => Ok(output),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub async fn copy_file(
    session_id: String,
    source_path: String,
    dest_path: String,
    state: State<'_, Arc<SessionManager>>,
) -> Result<bool, String> {
    let session = state
        .get_session(&session_id)
        .await
        .ok_or("Session not found")?;

    let client = session.read().await;
    let command = format!("cp -r '{}' '{}'", source_path, dest_path);
    
    match client.execute_command(&command).await {
        Ok(_) => Ok(true),
        Err(e) => Err(e.to_string()),
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProcessInfo {
    pub pid: String,
    pub user: String,
    pub cpu: String,
    pub mem: String,
    pub command: String,
}

#[derive(Debug, Serialize)]
pub struct ProcessListResponse {
    pub success: bool,
    pub processes: Option<Vec<ProcessInfo>>,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn get_processes(
    session_id: String,
    sort_by: Option<String>,
    state: State<'_, Arc<SessionManager>>,
) -> Result<ProcessListResponse, String> {
    let session = state
        .get_session(&session_id)
        .await
        .ok_or("Session not found")?;

    let client = session.read().await;
    
    // Execute ps command to get process list
    // Using ps aux for detailed process information
    // Support sorting by cpu (default) or memory
    let sort_option = match sort_by.as_deref() {
        Some("mem") => "-%mem",
        _ => "-%cpu", // Default to CPU sorting
    };
    let command = format!("ps aux --sort={} | head -50", sort_option);
    
    match client.execute_command(&command).await {
        Ok(output) => {
            let mut processes = Vec::new();
            
            // Parse ps output (skip header line)
            for line in output.lines().skip(1) {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 11 {
                    processes.push(ProcessInfo {
                        user: parts[0].to_string(),
                        pid: parts[1].to_string(),
                        cpu: parts[2].to_string(),
                        mem: parts[3].to_string(),
                        command: parts[10..].join(" "),
                    });
                }
            }
            
            Ok(ProcessListResponse {
                success: true,
                processes: Some(processes),
                error: None,
            })
        },
        Err(e) => Ok(ProcessListResponse {
            success: false,
            processes: None,
            error: Some(e.to_string()),
        }),
    }
}

#[tauri::command]
pub async fn kill_process(
    session_id: String,
    pid: String,
    signal: Option<String>,
    state: State<'_, Arc<SessionManager>>,
) -> Result<CommandResponse, String> {
    let session = state
        .get_session(&session_id)
        .await
        .ok_or("Session not found")?;

    let client = session.read().await;
    
    // Default to SIGTERM (15), can also use SIGKILL (9)
    let sig = signal.unwrap_or_else(|| "15".to_string());
    let command = format!("kill -{} {}", sig, pid);
    
    match client.execute_command(&command).await {
        Ok(output) => Ok(CommandResponse {
            success: true,
            output: Some(output),
            error: None,
        }),
        Err(e) => Ok(CommandResponse {
            success: false,
            output: None,
            error: Some(e.to_string()),
        }),
    }
}

#[tauri::command]
pub async fn list_sessions(
    state: State<'_, Arc<SessionManager>>,
) -> Result<Vec<String>, String> {
    Ok(state.list_sessions().await)
}

#[derive(Debug, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct TailLogRequest {
    pub session_id: String,
    pub log_path: String,
    pub lines: Option<u32>, // Number of lines to show (default 50)
}

#[tauri::command]
pub async fn tail_log(
    session_id: String,
    log_path: String,
    lines: Option<u32>,
    state: State<'_, Arc<SessionManager>>,
) -> Result<CommandResponse, String> {
    let session = state
        .get_session(&session_id)
        .await
        .ok_or("Session not found")?;

    let client = session.read().await;
    
    let line_count = lines.unwrap_or(50);
    let command = format!("tail -n {} '{}'", line_count, log_path);
    
    match client.execute_command(&command).await {
        Ok(output) => Ok(CommandResponse {
            success: true,
            output: Some(output),
            error: None,
        }),
        Err(e) => Ok(CommandResponse {
            success: false,
            output: None,
            error: Some(e.to_string()),
        }),
    }
}

#[tauri::command]
pub async fn list_log_files(
    session_id: String,
    state: State<'_, Arc<SessionManager>>,
) -> Result<CommandResponse, String> {
    let session = state
        .get_session(&session_id)
        .await
        .ok_or("Session not found")?;

    let client = session.read().await;
    
    // Common log directories
    let command = "find /var/log -type f -name '*.log' 2>/dev/null | head -50";
    
    match client.execute_command(command).await {
        Ok(output) => Ok(CommandResponse {
            success: true,
            output: Some(output),
            error: None,
        }),
        Err(e) => Ok(CommandResponse {
            success: false,
            output: None,
            error: Some(e.to_string()),
        }),
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NetworkSocketStats {
    pub total: u32,
    pub tcp_total: u32,
    pub tcp_established: u32,
    pub tcp_timewait: u32,
    pub tcp_synrecv: u32,
    pub udp_total: u32,
}

#[derive(Debug, Serialize)]
pub struct NetworkSocketResponse {
    pub success: bool,
    pub stats: Option<NetworkSocketStats>,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn get_network_socket_stats(
    session_id: String,
    state: State<'_, Arc<SessionManager>>,
) -> Result<NetworkSocketResponse, String> {
    let session = state
        .get_session(&session_id)
        .await
        .ok_or("Session not found")?;

    let client = session.read().await;

    // Get socket stats using ss -s and also get SYN_RECV count specifically if not in ss -s summary
    // Some versions of ss -s might not show synrecv in summary, so we use a combined approach
    let command = "ss -s 2>/dev/null || echo 'Total: 0'; echo \"---SYNRECV---\"; ss -ant 2>/dev/null | grep -c SYN-RECV || echo 0";

    match client.execute_command(command).await {
        Ok(output) => {
            let mut stats = NetworkSocketStats {
                total: 0,
                tcp_total: 0,
                tcp_established: 0,
                tcp_timewait: 0,
                tcp_synrecv: 0,
                udp_total: 0,
            };

            let sections: Vec<&str> = output.split("---SYNRECV---").collect();
            
            // Parse ss -s output
            if let Some(ss_s_output) = sections.get(0) {
                for line in ss_s_output.lines() {
                    let line = line.trim();
                    if line.starts_with("Total:") {
                        stats.total = line.split_whitespace().nth(1).and_then(|s| s.parse().ok()).unwrap_or(0);
                    } else if line.starts_with("TCP:") {
                        // Format: TCP: 45 (estab 10, closed 5, orphaned 0, timewait 20)
                        stats.tcp_total = line.split_whitespace().nth(1).and_then(|s| s.parse().ok()).unwrap_or(0);
                        if let Some(estab_start) = line.find("estab ") {
                            let rest = &line[estab_start + 6..];
                            stats.tcp_established = rest.split(|c| c == ',' || c == ')').next().and_then(|s| s.trim().parse().ok()).unwrap_or(0);
                        }
                        if let Some(tw_start) = line.find("timewait ") {
                            let rest = &line[tw_start + 9..];
                            stats.tcp_timewait = rest.split(|c| c == ',' || c == ')').next().and_then(|s| s.trim().parse().ok()).unwrap_or(0);
                        }
                    } else if line.starts_with("UDP:") {
                        stats.udp_total = line.split_whitespace().nth(1).and_then(|s| s.parse().ok()).unwrap_or(0);
                    }
                }
            }

            // Parse SYN_RECV count
            if let Some(synrecv_output) = sections.get(1) {
                stats.tcp_synrecv = synrecv_output.trim().parse().unwrap_or(0);
            }

            Ok(NetworkSocketResponse {
                success: true,
                stats: Some(stats),
                error: None,
            })
        }
        Err(e) => Ok(NetworkSocketResponse {
            success: false,
            stats: None,
            error: Some(e.to_string()),
        }),
    }
}

// Network interface statistics
#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct NetworkInterface {
    pub name: String,
    pub rx_bytes: u64,
    pub tx_bytes: u64,
    pub rx_packets: u64,
    pub tx_packets: u64,
}

#[derive(Debug, serde::Serialize)]
pub struct NetworkStatsResponse {
    pub success: bool,
    pub interfaces: Vec<NetworkInterface>,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn get_network_stats(
    session_id: String,
    state: State<'_, Arc<SessionManager>>,
) -> Result<NetworkStatsResponse, String> {
    let session = state
        .get_session(&session_id)
        .await
        .ok_or("Session not found")?;

    let client = session.read().await;
    
    // Use /sys/class/net to get interface statistics
    let command = r#"
for iface in /sys/class/net/*; do
    name=$(basename $iface)
    if [ "$name" != "lo" ]; then
        rx_bytes=$(cat $iface/statistics/rx_bytes 2>/dev/null || echo 0)
        tx_bytes=$(cat $iface/statistics/tx_bytes 2>/dev/null || echo 0)
        rx_packets=$(cat $iface/statistics/rx_packets 2>/dev/null || echo 0)
        tx_packets=$(cat $iface/statistics/tx_packets 2>/dev/null || echo 0)
        echo "$name,$rx_bytes,$tx_bytes,$rx_packets,$tx_packets"
    fi
done
"#;
    
    match client.execute_command(command).await {
        Ok(output) => {
            let mut interfaces = Vec::new();
            
            for line in output.lines() {
                if line.trim().is_empty() {
                    continue;
                }
                
                let parts: Vec<&str> = line.split(',').collect();
                if parts.len() == 5 {
                    if let (Ok(rx_bytes), Ok(tx_bytes), Ok(rx_packets), Ok(tx_packets)) = (
                        parts[1].parse::<u64>(),
                        parts[2].parse::<u64>(),
                        parts[3].parse::<u64>(),
                        parts[4].parse::<u64>(),
                    ) {
                        interfaces.push(NetworkInterface {
                            name: parts[0].to_string(),
                            rx_bytes,
                            tx_bytes,
                            rx_packets,
                            tx_packets,
                        });
                    }
                }
            }
            
            Ok(NetworkStatsResponse {
                success: true,
                interfaces,
                error: None,
            })
        }
        Err(e) => Ok(NetworkStatsResponse {
            success: false,
            interfaces: Vec::new(),
            error: Some(e.to_string()),
        }),
    }
}

// Active network connections
#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct NetworkConnection {
    pub protocol: String,
    pub local_address: String,
    pub remote_address: String,
    pub state: String,
    pub pid_program: String,
}

#[derive(Debug, serde::Serialize)]
pub struct ConnectionsResponse {
    pub success: bool,
    pub connections: Vec<NetworkConnection>,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn get_active_connections(
    session_id: String,
    state: State<'_, Arc<SessionManager>>,
) -> Result<ConnectionsResponse, String> {
    let session = state
        .get_session(&session_id)
        .await
        .ok_or("Session not found")?;

    let client = session.read().await;
    
    // Use ss command (modern replacement for netstat)
    // -t: TCP, -u: UDP, -n: numeric, -p: show process
    let command = "ss -tunp 2>/dev/null | tail -n +2 | head -50";
    
    match client.execute_command(command).await {
        Ok(output) => {
            let mut connections = Vec::new();
            
            for line in output.lines() {
                if line.trim().is_empty() {
                    continue;
                }
                
                // Parse ss output format: Proto Recv-Q Send-Q Local-Address:Port Peer-Address:Port Process
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 5 {
                    let protocol = parts[0].to_string();
                    let local_address = parts[4].to_string();
                    let remote_address = parts[5].to_string();
                    let state = if parts.len() > 1 && parts[1] != "0" { 
                        "ESTAB".to_string() 
                    } else { 
                        parts.get(1).unwrap_or(&"").to_string() 
                    };
                    let pid_program = parts.get(6).unwrap_or(&"").to_string();
                    
                    connections.push(NetworkConnection {
                        protocol,
                        local_address,
                        remote_address,
                        state,
                        pid_program,
                    });
                }
            }
            
            Ok(ConnectionsResponse {
                success: true,
                connections,
                error: None,
            })
        }
        Err(e) => Ok(ConnectionsResponse {
            success: false,
            connections: Vec::new(),
            error: Some(e.to_string()),
        }),
    }
}

// Network bandwidth monitoring (real-time)
#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct NetworkBandwidth {
    pub interface: String,
    pub rx_bytes_per_sec: f64,
    pub tx_bytes_per_sec: f64,
}

#[derive(Debug, serde::Serialize)]
pub struct BandwidthResponse {
    pub success: bool,
    pub bandwidth: Vec<NetworkBandwidth>,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn get_network_bandwidth(
    session_id: String,
    state: State<'_, Arc<SessionManager>>,
) -> Result<BandwidthResponse, String> {
    let session = state
        .get_session(&session_id)
        .await
        .ok_or("Session not found")?;

    let client = session.read().await;
    
    // Sample network stats twice with 1 second interval to calculate rates
    let command = r#"
iface_list=""
for iface in /sys/class/net/*; do
    name=$(basename $iface)
    if [ "$name" != "lo" ]; then
        iface_list="$iface_list $name"
    fi
done

for iface in $iface_list; do
    rx1=$(cat /sys/class/net/$iface/statistics/rx_bytes 2>/dev/null || echo 0)
    tx1=$(cat /sys/class/net/$iface/statistics/tx_bytes 2>/dev/null || echo 0)
    echo "$iface,$rx1,$tx1"
done
sleep 1
for iface in $iface_list; do
    rx2=$(cat /sys/class/net/$iface/statistics/rx_bytes 2>/dev/null || echo 0)
    tx2=$(cat /sys/class/net/$iface/statistics/tx_bytes 2>/dev/null || echo 0)
    echo "$iface,$rx2,$tx2"
done
"#;
    
    match client.execute_command(command).await {
        Ok(output) => {
            let lines: Vec<&str> = output.lines().collect();
            let mut bandwidth = Vec::new();
            
            // Split into before and after measurements
            let mid = lines.len() / 2;
            let before = &lines[0..mid];
            let after = &lines[mid..];
            
            for (before_line, after_line) in before.iter().zip(after.iter()) {
                let before_parts: Vec<&str> = before_line.split(',').collect();
                let after_parts: Vec<&str> = after_line.split(',').collect();
                
                if before_parts.len() == 3 && after_parts.len() == 3 && before_parts[0] == after_parts[0] {
                    if let (Ok(rx1), Ok(tx1), Ok(rx2), Ok(tx2)) = (
                        before_parts[1].parse::<f64>(),
                        before_parts[2].parse::<f64>(),
                        after_parts[1].parse::<f64>(),
                        after_parts[2].parse::<f64>(),
                    ) {
                        // Calculate bytes per second
                        let rx_bytes_per_sec = rx2 - rx1;
                        let tx_bytes_per_sec = tx2 - tx1;
                        
                        bandwidth.push(NetworkBandwidth {
                            interface: before_parts[0].to_string(),
                            rx_bytes_per_sec,
                            tx_bytes_per_sec,
                        });
                    }
                }
            }
            
            Ok(BandwidthResponse {
                success: true,
                bandwidth,
                error: None,
            })
        }
        Err(e) => Ok(BandwidthResponse {
            success: false,
            bandwidth: Vec::new(),
            error: Some(e.to_string()),
        }),
    }
}

// Network latency monitoring (ping test)
#[derive(Debug, serde::Serialize)]
pub struct LatencyResponse {
    pub success: bool,
    pub latency_ms: Option<f64>,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn get_network_latency(
    session_id: String,
    target: Option<String>,
    state: State<'_, Arc<SessionManager>>,
) -> Result<LatencyResponse, String> {
    let session = state
        .get_session(&session_id)
        .await
        .ok_or("Session not found")?;

    let client = session.read().await;
    
    // Default to pinging gateway if no target specified
    let ping_target = target.unwrap_or_else(|| "8.8.8.8".to_string());
    
    // Use ping with count=1 and timeout=1 second
    let command = format!("ping -c 1 -W 1 {} 2>&1 | grep -oP 'time=\\K[0-9.]+' || echo 'timeout'", ping_target);
    
    match client.execute_command(&command).await {
        Ok(output) => {
            let trimmed = output.trim();
            
            if trimmed == "timeout" || trimmed.is_empty() {
                Ok(LatencyResponse {
                    success: false,
                    latency_ms: None,
                    error: Some("Ping timeout or unreachable".to_string()),
                })
            } else {
                match trimmed.parse::<f64>() {
                    Ok(latency) => Ok(LatencyResponse {
                        success: true,
                        latency_ms: Some(latency),
                        error: None,
                    }),
                    Err(_) => Ok(LatencyResponse {
                        success: false,
                        latency_ms: None,
                        error: Some("Failed to parse latency".to_string()),
                    }),
                }
            }
        }
        Err(e) => Ok(LatencyResponse {
            success: false,
            latency_ms: None,
            error: Some(e.to_string()),
        }),
    }
}

// Disk usage details
#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct DiskInfo {
    pub filesystem: String,
    pub path: String,
    pub total: String,
    pub available: String,
    pub usage: u32,
    pub inodes_total: String,
    pub inodes_usage: u32,
}

#[derive(Debug, serde::Serialize)]
pub struct DiskUsageResponse {
    pub success: bool,
    pub disks: Vec<DiskInfo>,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn get_disk_usage(
    session_id: String,
    state: State<'_, Arc<SessionManager>>,
) -> Result<DiskUsageResponse, String> {
    let session = state
        .get_session(&session_id)
        .await
        .ok_or("Session not found")?;

    let client = session.read().await;

    // Get both disk usage (-hT) and inodes (-iT) in one command for performance
    // We include more disks but keep a reasonable limit
    let command = "df -hT | awk 'NR>1 {print $1\"|\"$2\"|\"$3\"|\"$5\"|\"$6\"|\"$7}'; echo '---'; df -iT | awk 'NR>1 {print $1\"|\"$3\"|\"$6\"|\"$7}'";

    match client.execute_command(command).await {
        Ok(output) => {
            let sections: Vec<&str> = output.split("---").collect();
            if sections.len() < 2 {
                return Ok(DiskUsageResponse {
                    success: true,
                    disks: Vec::new(),
                    error: Some("Failed to parse disk information".to_string()),
                });
            }

            let h_lines = sections[0].lines();
            let i_lines = sections[1].lines();

            let mut inodes_map = std::collections::HashMap::new();
            for line in i_lines {
                let parts: Vec<&str> = line.trim().split('|').collect();
                if parts.len() >= 4 {
                    let filesystem = parts[0];
                    let total = parts[1];
                    let usage_pct = parts[2].trim_end_matches('%').parse::<u32>().unwrap_or(0);
                    let path = parts[3];
                    inodes_map.insert(
                        format!("{}:{}", filesystem, path),
                        (total.to_string(), usage_pct),
                    );
                }
            }

            let mut disks = Vec::new();
            for line in h_lines {
                let parts: Vec<&str> = line.trim().split('|').collect();
                if parts.len() >= 6 {
                    let filesystem = parts[0];
                    let _fstype = parts[1];
                    let total = parts[2];
                    let available = parts[3];
                    let usage = parts[4].trim_end_matches('%').parse::<u32>().unwrap_or(0);
                    let path = parts[5];

                    // Filter out some system filesystems that aren't useful to see
                    if total == "0" || total == "0K" || total == "0M" {
                        continue;
                    }

                    let (inodes_total, inodes_usage) = inodes_map
                        .get(&format!("{}:{}", filesystem, path))
                        .cloned()
                        .unwrap_or(("N/A".to_string(), 0));

                    disks.push(DiskInfo {
                        filesystem: filesystem.to_string(),
                        path: path.to_string(),
                        total: total.to_string(),
                        available: available.to_string(),
                        usage,
                        inodes_total,
                        inodes_usage,
                    });
                }
            }

            // Limit to top 20 disks for performance and space
            disks.truncate(20);

            Ok(DiskUsageResponse {
                success: true,
                disks,
                error: None,
            })
        }
        Err(e) => Ok(DiskUsageResponse {
            success: false,
            disks: Vec::new(),
            error: Some(e.to_string()),
        }),
    }
}

#[derive(Debug, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct TabCompletionRequest {
    pub session_id: String,
    pub input: String,
    pub cursor_position: usize,
}

#[derive(Debug, Serialize)]
pub struct TabCompletionResponse {
    pub success: bool,
    pub completions: Vec<String>,
    pub common_prefix: Option<String>,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn ssh_tab_complete(
    session_id: String,
    input: String,
    cursor_position: usize,
    state: State<'_, Arc<SessionManager>>,
) -> Result<TabCompletionResponse, String> {
    let session = state
        .get_session(&session_id)
        .await
        .ok_or("Session not found")?;

    let client = session.read().await;

    // Extract the word to complete (last word before cursor)
    let text_before_cursor = &input[..cursor_position.min(input.len())];
    let words: Vec<&str> = text_before_cursor.split_whitespace().collect();
    let word_to_complete = words.last().copied().unwrap_or("");
    
    // Determine completion type
    let is_first_word = words.len() <= 1;
    
    // Build completion command based on context
    let completion_cmd = if is_first_word {
        // Command completion: use compgen -c for commands
        format!("compgen -c {} 2>/dev/null || echo", word_to_complete)
    } else {
        // File/directory completion: use compgen -f for files
        format!("compgen -f {} 2>/dev/null || ls -1ap {} 2>/dev/null | grep '^{}' || echo", 
                word_to_complete, 
                if word_to_complete.is_empty() { "." } else { word_to_complete },
                word_to_complete)
    };

    match client.execute_command(&completion_cmd).await {
        Ok(output) => {
            let completions: Vec<String> = output
                .lines()
                .filter(|s| !s.is_empty() && s.starts_with(word_to_complete))
                .map(|s| s.trim().to_string())
                .take(50) // Limit to 50 completions
                .collect();

            // Find common prefix
            let common_prefix = if completions.len() > 1 {
                find_common_prefix(&completions)
            } else {
                None
            };

            Ok(TabCompletionResponse {
                success: true,
                completions,
                common_prefix,
                error: None,
            })
        }
        Err(e) => Ok(TabCompletionResponse {
            success: false,
            completions: Vec::new(),
            common_prefix: None,
            error: Some(e.to_string()),
        }),
    }
}

// Helper function to find common prefix among strings
fn find_common_prefix(strings: &[String]) -> Option<String> {
    if strings.is_empty() {
        return None;
    }
    if strings.len() == 1 {
        return Some(strings[0].clone());
    }

    let first = &strings[0];
    let mut prefix = String::new();

    for (i, ch) in first.chars().enumerate() {
        if strings.iter().all(|s| s.chars().nth(i) == Some(ch)) {
            prefix.push(ch);
        } else {
            break;
        }
    }

    if prefix.is_empty() || prefix == strings[0] {
        None
    } else {
        Some(prefix)
    }
}

#[tauri::command]
pub async fn get_system_info(
    session_id: String,
    state: State<'_, Arc<SessionManager>>,
) -> Result<SystemInfoResponse, String> {
    let session = state
        .get_session(&session_id)
        .await
        .ok_or("Session not found")?;

    let client = session.read().await;

    // OS information
    let os_cmd = "uname -s 2>/dev/null || echo 'Unknown'";
    let os = client.execute_command(os_cmd).await.unwrap_or_else(|_| "Unknown".to_string()).trim().to_string();

    // Kernel version
    let kernel_cmd = "uname -r 2>/dev/null || echo 'Unknown'";
    let kernel = client.execute_command(kernel_cmd).await.unwrap_or_else(|_| "Unknown".to_string()).trim().to_string();

    // Hostname
    let hostname_cmd = "hostname 2>/dev/null || uname -n 2>/dev/null || echo 'Unknown'";
    let hostname = client.execute_command(hostname_cmd).await.unwrap_or_else(|_| "Unknown".to_string()).trim().to_string();

    // Architecture
    let arch_cmd = "uname -m 2>/dev/null || echo 'Unknown'";
    let architecture = client.execute_command(arch_cmd).await.unwrap_or_else(|_| "Unknown".to_string()).trim().to_string();

    Ok(SystemInfoResponse {
        success: true,
        os,
        kernel,
        hostname,
        architecture,
    })
}

#[derive(Debug, Serialize)]
pub struct SystemInfoResponse {
    pub success: bool,
    pub os: String,
    pub kernel: String,
    pub hostname: String,
    pub architecture: String,
}

// ========== PTY Session ==========
// PTY terminal I/O now uses WebSocket instead of IPC for better performance
// WebSocket server runs on ws://127.0.0.1:9001
// See src/websocket_server.rs for implementation
