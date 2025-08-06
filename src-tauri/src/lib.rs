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

    let mut cmd = CommandBuilder::new("/bin/bash");
    cmd.env("TERM", "xterm-256color");

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
            list_directory
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
