use std::process::Command;
#[tauri::command]
async fn launch_chrome_cdp(url: String) -> Result<(), String> {
    // Find Chrome binary (cross-platform)
    #[cfg(target_os = "macos")]
    let chrome_path = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
    #[cfg(target_os = "windows")]
    let chrome_path = {
        let candidates = [
            r"C:\Program Files\Google\Chrome\Application\chrome.exe",
            r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        ];
        candidates.iter().find(|p| std::path::Path::new(p).exists()).map(|s| *s).unwrap_or("chrome.exe")
    };
    #[cfg(target_os = "linux")]
    let chrome_path = {
        let candidates = [
            "/usr/bin/google-chrome",
            "/usr/bin/chromium-browser",
            "/usr/bin/chrome",
        ];
        candidates.iter().find(|p| std::path::Path::new(p).exists()).map(|s| *s).unwrap_or("google-chrome")
    };
    // Use port 9222 for remote debugging
    let port = "9222";
    let status = Command::new(chrome_path)
        .arg("--remote-debugging-port=".to_owned() + port)
        .arg(url)
        .spawn()
        .map_err(|e| format!("Failed to launch Chrome: {}", e))?;
    Ok(())
}
mod cdp_ws;
use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem, MasterPty};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::{Read, Write};
use std::path::Path;
use std::sync::Arc;
use tokio::sync::Mutex;
use uuid::Uuid;
use tauri::Emitter; // Needed for .emit()

#[tauri::command]
async fn connect_cdp_websocket(website_url: String, window: tauri::Window) -> Result<(), String> {
    use futures_util::{SinkExt, StreamExt};
    use tokio_tungstenite::connect_async;
    use serde_json::json;
    use url::Url;

    // Find Chrome binary (cross-platform)
    #[cfg(target_os = "macos")]
    let chrome_path = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
    #[cfg(target_os = "windows")]
    let chrome_path = {
        let candidates = [
            r"C:\Program Files\Google\Chrome\Application\chrome.exe",
            r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        ];
        candidates.iter().find(|p| std::path::Path::new(p).exists()).map(|s| *s).unwrap_or("chrome.exe")
    };
    #[cfg(target_os = "linux")]
    let chrome_path = {
        let candidates = [
            "/usr/bin/google-chrome",
            "/usr/bin/chromium-browser",
            "/usr/bin/chrome",
        ];
        candidates.iter().find(|p| std::path::Path::new(p).exists()).map(|s| *s).unwrap_or("google-chrome")
    };
    let port = "9222";
    let user_data_dir = "/tmp/chrome-cdp-isolated";
    let _status = std::process::Command::new(chrome_path)
        .arg("--remote-debugging-port=".to_owned() + port)
        .arg(format!("--user-data-dir={}", user_data_dir))
        .arg("--no-first-run")
        .arg("--no-default-browser-check")
        .arg(format!("--app={}", website_url))
        .spawn()
        .map_err(|e| format!("Failed to launch Chrome: {}", e))?;

    // Wait for Chrome to start and expose the CDP endpoint
    tokio::time::sleep(std::time::Duration::from_secs(5)).await;

    // Retry fetching targets and match by URL prefix/contains
    let targets_url = format!("http://localhost:{}/json/list", port);
    let mut target_id = None;
    for _ in 0..10 {
        let resp = reqwest::get(&targets_url).await;
        if let Ok(resp) = resp {
            if let Ok(targets) = resp.json::<serde_json::Value>().await {
                if let Some(arr) = targets.as_array() {
                    // Try exact match first
                    if let Some(target) = arr.iter().find(|t| t.get("type").and_then(|ty| ty.as_str()) == Some("page") && t.get("url").and_then(|u| u.as_str()) == Some(&website_url)) {
                        target_id = target.get("id").and_then(|id| id.as_str()).map(|s| s.to_string());
                        break;
                    }
                    // Try starts_with
                    if let Some(target) = arr.iter().find(|t| t.get("type").and_then(|ty| ty.as_str()) == Some("page") && t.get("url").and_then(|u| u.as_str()).map(|u| u.starts_with(&website_url)).unwrap_or(false)) {
                        target_id = target.get("id").and_then(|id| id.as_str()).map(|s| s.to_string());
                        break;
                    }
                    // Try contains
                    if let Some(target) = arr.iter().find(|t| t.get("type").and_then(|ty| ty.as_str()) == Some("page") && t.get("url").and_then(|u| u.as_str()).map(|u| u.contains(&website_url)).unwrap_or(false)) {
                        target_id = target.get("id").and_then(|id| id.as_str()).map(|s| s.to_string());
                        break;
                    }
                }
            }
        }
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
    }
    let target_id = target_id.ok_or("No matching target found")?;

    // Fetch browser-level WebSocket endpoint
    let browser_ws_url = {
        let resp = reqwest::get(&format!("http://localhost:{}/json/version", port)).await
            .map_err(|e| format!("Failed to fetch CDP version: {}", e))?;
        let json: serde_json::Value = resp.json().await.map_err(|e| format!("Failed to parse CDP version: {}", e))?;
        json.get("webSocketDebuggerUrl")
            .and_then(|v| v.as_str())
            .ok_or("No browser WebSocket endpoint found")?
            .to_string()
    };

    // Connect to browser WebSocket
    let url = url::Url::parse(&browser_ws_url).map_err(|e| format!("Invalid WebSocket URL: {}", e))?;
    let (mut ws_stream, _) = connect_async(url.as_str())
        .await
        .map_err(|e| format!("WebSocket connect error: {}", e))?;

    // Attach to the existing target and get sessionId
    let attach_cmd = json!({
        "id": 2,
        "method": "Target.attachToTarget",
        "params": { "targetId": target_id, "flatten": true }
    });
    ws_stream.send(tokio_tungstenite::tungstenite::Message::Text(attach_cmd.to_string().into())).await.map_err(|e| format!("Failed to send attachToTarget: {}", e))?;

    // Wait for response to get sessionId
    let mut session_id = None;
    while let Some(msg) = ws_stream.next().await {
        if let Ok(tokio_tungstenite::tungstenite::Message::Text(text)) = msg {
            if let Ok(resp) = serde_json::from_str::<serde_json::Value>(&text) {
                if let Some(id) = resp.get("result").and_then(|r| r.get("sessionId")).and_then(|t| t.as_str()) {
                    session_id = Some(id.to_string());
                    break;
                }
            }
        }
    }
    let session_id = session_id.ok_or("Failed to get sessionId from attachToTarget")?;

    // Enable relevant domains (Network, Console, etc.) using sessionId
    let enable_cmds = [
        json!({"id": 3, "method": "Network.enable", "params": {}, "sessionId": session_id}),
        json!({"id": 4, "method": "Console.enable", "params": {}, "sessionId": session_id}),
        json!({"id": 5, "method": "Runtime.enable", "params": {}, "sessionId": session_id}),
        json!({"id": 6, "method": "Debugger.enable", "params": {}, "sessionId": session_id}),
        json!({"id": 7, "method": "Storage.enable", "params": {}, "sessionId": session_id}),
        json!({"id": 8, "method": "Inspector.enable", "params": {}, "sessionId": session_id}),
    ];
    for cmd in enable_cmds.iter() {
        ws_stream.send(tokio_tungstenite::tungstenite::Message::Text(cmd.to_string().into())).await.map_err(|e| format!("Failed to send enable command: {}", e))?;
    }

    // Stream all incoming messages and emit to frontend
    while let Some(msg) = ws_stream.next().await {
        match msg {
            Ok(tokio_tungstenite::tungstenite::Message::Text(text)) => {
                let s = text.to_string();
                let _ = window.emit("cdp-event", s);
            }
            Ok(_) => {}
            Err(e) => {
                let _ = window.emit("cdp-event", format!("WebSocket error: {}", e));
                break;
            }
        }
    }
    Ok(())
}

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

pub struct TerminalSessionData {
    pub session: TerminalSession,
    pub master: Option<Box<dyn MasterPty + Send>>,
    pub writer: Option<Box<dyn Write + Send>>, // Store writer once
}

type TerminalState = Arc<Mutex<HashMap<String, TerminalSessionData>>>;

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
    window: tauri::Window,
    state: tauri::State<'_, AppState>,
) -> Result<TerminalSession, String> {
    let session_id = Uuid::new_v4().to_string();
    let session = TerminalSession {
        id: session_id.clone(),
        name: "Terminal".to_string(),
        working_directory: working_directory.clone(),
    };

    let pty_system = NativePtySystem::default();
    let pair = PtySystem::openpty(&pty_system, PtySize {
        rows: 24,
        cols: 80,
        pixel_width: 0,
        pixel_height: 0,
    }).map_err(|e| format!("PTY error: {}", e))?;

    // Detect OS and set default shell
    #[cfg(target_os = "macos")]
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
    #[cfg(target_os = "linux")]
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string());
    #[cfg(target_os = "windows")]
    let shell = "powershell.exe".to_string();
    let mut cmd = CommandBuilder::new(shell);
    cmd.env("TERM", "xterm-256color");
    cmd.cwd(&working_directory);

    pair.slave.spawn_command(cmd).map_err(|e| format!("Failed spawning shell: {}", e))?;

    let mut reader = pair.master.try_clone_reader().map_err(|e| format!("Failed reader: {}", e))?;
    let writer = pair.master.take_writer().map_err(|e| format!("Failed writer: {}", e))?;

    let session_id_clone = session_id.clone();
    let window_clone = window.clone();
    tokio::spawn(async move {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(n) if n > 0 => {
                    let output = String::from_utf8_lossy(&buf[..n]).to_string();
                    if let Err(e) = window_clone.emit(
                        "terminal-data",
                        serde_json::json!({ "id": session_id_clone, "data": output }),
                    ) {
                        eprintln!("Emit failed: {}", e);
                        break;
                    }
                }
                Ok(_) => break,
                Err(e) => {
                    eprintln!("PTY read error: {}", e);
                    break;
                }
            }
        }
    });

    let data = TerminalSessionData {
        session: session.clone(),
        master: Some(pair.master),
        writer: Some(writer),
    };

    state.terminals.lock().await.insert(session_id.clone(), data);
    Ok(session)
}

#[tauri::command]
async fn write_to_pty(
    session_id: String,
    input: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let mut terminals = state.terminals.lock().await;
    let data = terminals.get_mut(&session_id).ok_or("Session not found")?;

    if let Some(writer) = &mut data.writer {
        writer.write_all(input.as_bytes()).map_err(|e| format!("Write error: {}", e))?;
    } else {
        return Err("Writer not available".to_string());
    }
    Ok(())
}

#[tauri::command]
async fn close_terminal_session(
    session_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    state.terminals.lock().await.remove(&session_id);
    Ok(())
}

#[tauri::command]
async fn cleanup_all_terminals(state: tauri::State<'_, AppState>) -> Result<(), String> {
    state.terminals.lock().await.clear();
    Ok(())
}

#[tauri::command]
async fn read_file_content(file_path: String) -> Result<String, String> {
    fs::read_to_string(&file_path).map_err(|e| format!("{}", e))
}

#[tauri::command]
async fn write_file_content(file_path: String, content: String) -> Result<(), String> {
    fs::write(&file_path, content).map_err(|e| format!("{}", e))
}

#[tauri::command]
async fn get_file_info(file_path: String) -> Result<FileInfo, String> {
    let metadata = fs::metadata(&file_path).map_err(|e| format!("{}", e))?;
    Ok(FileInfo {
        name: Path::new(&file_path).file_name().unwrap_or_default().to_string_lossy().into(),
        path: file_path.clone(),
        is_directory: metadata.is_dir(),
        size: metadata.len(),
    })
}

#[tauri::command]
async fn list_directory(dir_path: String) -> Result<Vec<FileInfo>, String> {
    let entries = fs::read_dir(&dir_path).map_err(|e| format!("{}", e))?;
    let mut files = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|e| format!("{}", e))?;
        let path = entry.path();
        let metadata = entry.metadata().map_err(|e| format!("{}", e))?;
        files.push(FileInfo {
            name: path.file_name().unwrap_or_default().to_string_lossy().into(),
            path: path.to_string_lossy().into(),
            is_directory: metadata.is_dir(),
            size: metadata.len(),
        });
    }
    files.sort_by(|a, b| (b.is_directory, &a.name).cmp(&(a.is_directory, &b.name)));
    Ok(files)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_state = AppState::new();
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            create_terminal_session,
            write_to_pty,
            close_terminal_session,
            cleanup_all_terminals,
            read_file_content,
            write_file_content,
            get_file_info,
            list_directory,
            connect_cdp_websocket
            ,launch_chrome_cdp
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
