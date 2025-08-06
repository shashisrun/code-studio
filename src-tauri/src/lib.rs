use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::sync::Arc;
use tokio::sync::Mutex;
use uuid::Uuid;
use std::process::{Stdio, Command};
use std::os::unix::process::CommandExt;

#[derive(Debug, Serialize, Deserialize)]
pub struct FileInfo {
    name: String,
    path: String,
    is_directory: bool,
    size: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TerminalSession {
    id: String,
    name: String,
    working_directory: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TerminalOutput {
    session_id: String,
    output: String,
    exit_code: Option<i32>,
}

// Global state for terminal sessions with process tracking
type TerminalState = Arc<Mutex<HashMap<String, TerminalSessionData>>>;

#[derive(Clone)]
pub struct TerminalSessionData {
    pub session: TerminalSession,
    pub running_processes: Vec<u32>, // Track PIDs of running processes
    pub process_group_id: Option<i32>, // Track process group for cleanup
    pub current_process: Option<Arc<Mutex<tokio::process::Child>>>, // Current running process
    pub output_buffer: Arc<Mutex<String>>, // Buffer for streaming output
    pub is_interactive: bool, // Track if this is an interactive session
}

pub struct AppState {
    terminals: TerminalState,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            terminals: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

#[tauri::command]
async fn create_terminal_session(
    working_directory: String,
    state: tauri::State<'_, AppState>,
) -> Result<TerminalSession, String> {
    let session_id = Uuid::new_v4().to_string();
    
    let session = TerminalSession {
        id: session_id.clone(),
        name: "Terminal".to_string(),
        working_directory: working_directory.clone(),
    };

    let session_data = TerminalSessionData {
        session: session.clone(),
        running_processes: Vec::new(),
        process_group_id: None,
        current_process: None,
        output_buffer: Arc::new(Mutex::new(String::new())),
        is_interactive: false,
    };

    // Store the session
    let mut terminals = state.terminals.lock().await;
    terminals.insert(session_id.clone(), session_data);

    Ok(session)
}

// Send input to the running interactive process (PTY support)
#[tauri::command]
async fn send_input_to_process(
    session_id: String,
    input: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let terminals = state.terminals.lock().await;
    
    if let Some(session_data) = terminals.get(&session_id) {
        // Send input to regular process stdin
        if let Some(current_process) = &session_data.current_process {
            let mut process = current_process.lock().await;
            if let Some(stdin) = process.stdin.as_mut() {
                use tokio::io::AsyncWriteExt;
                stdin.write_all((input + "\n").as_bytes()).await
                    .map_err(|e| format!("Failed to send input: {}", e))?;
                stdin.flush().await
                    .map_err(|e| format!("Failed to flush input: {}", e))?;
                return Ok(());
            }
        }
        
        Err("No active process to send input to".to_string())
    } else {
        Err("Terminal session not found".to_string())
    }
}

// Get streaming output from the running process
#[tauri::command]
async fn get_process_output(
    session_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    let terminals = state.terminals.lock().await;
    
    if let Some(session_data) = terminals.get(&session_id) {
        if let Some(current_process) = &session_data.current_process {
            let mut process = current_process.lock().await;
            
            // Check if process is still running
            match process.try_wait() {
                Ok(Some(exit_status)) => {
                    // Process exited, get any remaining output
                    let mut buffer = session_data.output_buffer.lock().await;
                    let output = buffer.clone();
                    buffer.clear();
                    
                    if !output.is_empty() {
                        return Ok(format!("{}\n__PROCESS_EXITED__:{:?}", output, exit_status.code()));
                    } else {
                        return Ok(format!("__PROCESS_EXITED__:{:?}", exit_status.code()));
                    }
                }
                Ok(None) => {
                    // Process is still running, get buffered output
                    let mut buffer = session_data.output_buffer.lock().await;
                    if !buffer.is_empty() {
                        let output = buffer.clone();
                        buffer.clear();
                        Ok(output)
                    } else {
                        Ok("".to_string()) // No new output
                    }
                }
                Err(_) => Ok("__PROCESS_ERROR__".to_string()),
            }
        } else {
            // No process running
            Ok("__NO_PROCESS__".to_string())
        }
    } else {
        Err("Terminal session not found".to_string())
    }
}

// Kill the current running process (Ctrl+C equivalent)
#[tauri::command]
async fn kill_current_process(
    session_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let mut terminals = state.terminals.lock().await;
    
    if let Some(session_data) = terminals.get_mut(&session_id) {
        if let Some(current_process) = &session_data.current_process {
            let mut process = current_process.lock().await;
            
            // Get PID for process group killing
            if let Some(pid) = process.id() {
                #[cfg(unix)]
                {
                    // Kill the entire process group
                    unsafe {
                        libc::kill(-(pid as i32), libc::SIGTERM);
                        // Give it a moment to clean up
                        std::thread::sleep(std::time::Duration::from_millis(100));
                        libc::kill(-(pid as i32), libc::SIGKILL);
                    }
                }
                
                #[cfg(windows)]
                {
                    // Windows: kill the process tree
                    let _ = std::process::Command::new("taskkill")
                        .args(["/F", "/T", "/PID", &pid.to_string()])
                        .output();
                }
                
                session_data.running_processes.retain(|&p| p != pid);
            }
            
            let _ = process.kill().await;
        }
        
        // Clear the current process and output buffer
        session_data.current_process = None;
        session_data.process_group_id = None;
        
        // Clear output buffer
        {
            let mut buffer = session_data.output_buffer.lock().await;
            buffer.clear();
        }
        
        Ok(())
    } else {
        Err("Terminal session not found".to_string())
    }
}

#[tauri::command]
async fn execute_terminal_command(
    session_id: String,
    command: String,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    let mut terminals = state.terminals.lock().await;
    
    if let Some(session_data) = terminals.get_mut(&session_id) {
        // Execute commands using std::process with process group
        #[cfg(unix)]
        {
            let mut cmd = Command::new("sh");
            cmd.arg("-c")
               .arg(&command)
               .current_dir(&session_data.session.working_directory)
               .stdout(Stdio::piped())
               .stderr(Stdio::piped())
               .process_group(0); // Create new process group
            
            let child = cmd.spawn()
                .map_err(|e| format!("Failed to spawn command: {}", e))?;

            // Track the process group ID for cleanup
            let pid = child.id();
            session_data.running_processes.push(pid);
            session_data.process_group_id = Some(pid as i32);

            let output = child.wait_with_output()
                .map_err(|e| format!("Failed to execute command: {}", e))?;

            // Remove the process from tracking since it's finished
            if let Some(pid) = output.status.code() {
                session_data.running_processes.retain(|&p| p != pid as u32);
            }

            let stdout = String::from_utf8_lossy(&output.stdout);
            let stderr = String::from_utf8_lossy(&output.stderr);
            
            if !stderr.is_empty() {
                Ok(format!("{}{}", stdout, stderr))
            } else {
                Ok(stdout.to_string())
            }
        }
        
        #[cfg(windows)]
        {
            // Windows fallback - simpler implementation
            let output = std::process::Command::new("cmd")
                .args(["/C", &command])
                .current_dir(&session_data.session.working_directory)
                .output()
                .map_err(|e| format!("Failed to execute command: {}", e))?;

            let stdout = String::from_utf8_lossy(&output.stdout);
            let stderr = String::from_utf8_lossy(&output.stderr);
            
            if !stderr.is_empty() {
                Ok(format!("{}{}", stdout, stderr))
            } else {
                Ok(stdout.to_string())
            }
        }
    } else {
        Err("Terminal session not found".to_string())
    }
}

#[tauri::command]
async fn close_terminal_session(
    session_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let mut terminals = state.terminals.lock().await;
    
    if let Some(session_data) = terminals.remove(&session_id) {
        // Kill current interactive process first
        if let Some(current_process) = &session_data.current_process {
            let mut process = current_process.lock().await;
            
            // Kill process group properly
            if let Some(pid) = process.id() {
                #[cfg(unix)]
                {
                    unsafe {
                        libc::kill(-(pid as i32), libc::SIGTERM);
                        std::thread::sleep(std::time::Duration::from_millis(100));
                        libc::kill(-(pid as i32), libc::SIGKILL);
                    }
                }
                
                #[cfg(windows)]
                {
                    let _ = std::process::Command::new("taskkill")
                        .args(["/F", "/T", "/PID", &pid.to_string()])
                        .output();
                }
            }
            
            let _ = process.kill().await;
        }
        
        // Kill process group and individual processes
        #[cfg(unix)]
        {
            // Kill the entire process group first
            if let Some(pgid) = session_data.process_group_id {
                unsafe {
                    libc::kill(-pgid, libc::SIGTERM);
                    // Give processes time to clean up
                    std::thread::sleep(std::time::Duration::from_millis(100));
                    libc::kill(-pgid, libc::SIGKILL);
                }
            }
            
            // Kill any remaining individual processes
            for pid in session_data.running_processes {
                unsafe {
                    libc::kill(pid as i32, libc::SIGTERM);
                    std::thread::sleep(std::time::Duration::from_millis(50));
                    libc::kill(pid as i32, libc::SIGKILL);
                }
            }
        }
        
        #[cfg(windows)]
        {
            // Windows process cleanup would go here
            for pid in session_data.running_processes {
                let _ = std::process::Command::new("taskkill")
                    .args(["/F", "/PID", &pid.to_string()])
                    .output();
            }
        }
    }
    
    Ok(())
}

// Cleanup all processes when app is shutting down
#[tauri::command]
async fn cleanup_all_terminals(state: tauri::State<'_, AppState>) -> Result<(), String> {
    let mut terminals = state.terminals.lock().await;
    
    for (_, session_data) in terminals.drain() {
        // Kill current interactive processes first
        if let Some(current_process) = &session_data.current_process {
            let mut process = current_process.lock().await;
            
            if let Some(pid) = process.id() {
                #[cfg(unix)]
                {
                    unsafe {
                        libc::kill(-(pid as i32), libc::SIGTERM);
                        std::thread::sleep(std::time::Duration::from_millis(100));
                        libc::kill(-(pid as i32), libc::SIGKILL);
                    }
                }
                
                #[cfg(windows)]
                {
                    let _ = std::process::Command::new("taskkill")
                        .args(["/F", "/T", "/PID", &pid.to_string()])
                        .output();
                }
            }
            
            let _ = process.kill().await;
        }
        
        #[cfg(unix)]
        {
            // Kill process groups first
            if let Some(pgid) = session_data.process_group_id {
                unsafe {
                    libc::kill(-pgid, libc::SIGTERM);
                    std::thread::sleep(std::time::Duration::from_millis(100));
                    libc::kill(-pgid, libc::SIGKILL);
                }
            }
            
            // Kill individual processes
            for pid in session_data.running_processes {
                unsafe {
                    libc::kill(pid as i32, libc::SIGTERM);
                    std::thread::sleep(std::time::Duration::from_millis(50));
                    libc::kill(pid as i32, libc::SIGKILL);
                }
            }
        }
        
        #[cfg(windows)]
        {
            for pid in session_data.running_processes {
                let _ = std::process::Command::new("taskkill")
                    .args(["/F", "/PID", &pid.to_string()])
                    .output();
            }
        }
    }
    
    // Also cleanup development ports
    let _ = cleanup_dev_ports().await;
    
    Ok(())
}

// Kill process using a specific port (for development server cleanup)
#[tauri::command]
async fn kill_port_process(port: u16) -> Result<(), String> {
    #[cfg(unix)]
    {
        // Find and kill process using the port
        let output = std::process::Command::new("lsof")
            .args(["-ti", &format!(":{}", port)])
            .output();
            
        if let Ok(output) = output {
            let pids = String::from_utf8_lossy(&output.stdout);
            for pid_str in pids.lines() {
                if let Ok(pid) = pid_str.trim().parse::<i32>() {
                    unsafe {
                        libc::kill(pid, libc::SIGTERM);
                        // Give it a moment, then force kill if necessary
                        std::thread::sleep(std::time::Duration::from_millis(100));
                        libc::kill(pid, libc::SIGKILL);
                    }
                }
            }
        }
    }
    
    #[cfg(windows)]
    {
        // Windows port cleanup using netstat and taskkill
        let output = std::process::Command::new("netstat")
            .args(["-ano"])
            .output();
            
        if let Ok(output) = output {
            let netstat_output = String::from_utf8_lossy(&output.stdout);
            for line in netstat_output.lines() {
                if line.contains(&format!(":{}", port)) && line.contains("LISTENING") {
                    if let Some(pid_str) = line.split_whitespace().last() {
                        if let Ok(pid) = pid_str.parse::<u32>() {
                            let _ = std::process::Command::new("taskkill")
                                .args(["/F", "/PID", &pid.to_string()])
                                .output();
                        }
                    }
                }
            }
        }
    }
    
    Ok(())
}

// Cleanup multiple development ports
#[tauri::command]
async fn cleanup_dev_ports() -> Result<(), String> {
    let common_ports = [1420, 1421, 1422, 1423, 3000, 5173, 8080];
    
    for &port in &common_ports {
        let _ = kill_port_process(port).await;
    }
    
    Ok(())
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// Detects the user's default shell (cross-platform)
#[tauri::command]
fn detect_default_shell() -> String {
    #[cfg(unix)]
    {
        use std::path::Path;
        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string());
        if Path::new(&shell).exists() {
            shell
        } else if Path::new("/bin/bash").exists() {
            "/bin/bash".to_string()
        } else if Path::new("/bin/zsh").exists() {
            "/bin/zsh".to_string()
        } else {
            "/bin/sh".to_string()
        }
    }
    #[cfg(windows)]
    {
        use std::path::Path;
        let comspec = std::env::var("ComSpec").unwrap_or_else(|_| "C:\\Windows\\System32\\cmd.exe".to_string());
        if Path::new(&comspec).exists() {
            comspec
        } else if Path::new("C:\\Windows\\System32\\cmd.exe").exists() {
            "C:\\Windows\\System32\\cmd.exe".to_string()
        } else {
            "cmd.exe".to_string()
        }
    }
}

#[tauri::command]
async fn read_file_content(file_path: String) -> Result<String, String> {
    fs::read_to_string(&file_path).map_err(|e| format!("Failed to read file: {}", e))
}

#[tauri::command]
async fn write_file_content(file_path: String, content: String) -> Result<(), String> {
    fs::write(&file_path, content).map_err(|e| format!("Failed to write file: {}", e))
}

#[tauri::command]
async fn get_file_info(file_path: String) -> Result<FileInfo, String> {
    let path = Path::new(&file_path);
    let metadata = fs::metadata(path).map_err(|e| format!("Failed to get file metadata: {}", e))?;

    Ok(FileInfo {
        name: path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string(),
        path: file_path,
        is_directory: metadata.is_dir(),
        size: metadata.len(),
    })
}

#[tauri::command]
async fn list_directory(dir_path: String) -> Result<Vec<FileInfo>, String> {
    let path = Path::new(&dir_path);
    let entries = fs::read_dir(path).map_err(|e| format!("Failed to read directory: {}", e))?;

    let mut files = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();
        let metadata = entry
            .metadata()
            .map_err(|e| format!("Failed to get metadata: {}", e))?;

        files.push(FileInfo {
            name: path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string(),
            path: path.to_string_lossy().to_string(),
            is_directory: metadata.is_dir(),
            size: metadata.len(),
        });
    }

    files.sort_by(|a, b| {
        // Directories first, then by name
        match (a.is_directory, b.is_directory) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.cmp(&b.name),
        }
    });

    Ok(files)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_state = AppState::new();
    
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_pty::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            greet,
            read_file_content,
            write_file_content,
            get_file_info,
            list_directory,
            create_terminal_session,
            execute_terminal_command,
            close_terminal_session,
            cleanup_all_terminals,
            kill_port_process,
            cleanup_dev_ports,
            send_input_to_process,
            get_process_output,
            kill_current_process
            ,detect_default_shell
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
