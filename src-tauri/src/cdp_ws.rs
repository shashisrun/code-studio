use tauri::{Window, Emitter};
use tokio_tungstenite::connect_async;
use futures_util::{SinkExt, StreamExt};
use serde_json::json;
use url::Url;

pub async fn connect_cdp_ws(window: Window, ws_url: String) -> Result<(), String> {
    let _url = Url::parse(&ws_url).map_err(|e| format!("Invalid WebSocket URL: {}", e))?;
    let (mut ws_stream, _) = connect_async(ws_url.as_str())
        .await
        .map_err(|e| format!("WebSocket connect error: {}", e))?;

    // Enable all relevant CDP domains
    let enable_cmds = [
        json!({"id": 1, "method": "Console.enable", "params": {}}),
        json!({"id": 2, "method": "Network.enable", "params": {}}),
        json!({"id": 3, "method": "Storage.enable", "params": {}}),
        json!({"id": 4, "method": "Runtime.enable", "params": {}}),
        json!({"id": 5, "method": "Debugger.enable", "params": {}}),
        json!({"id": 6, "method": "Inspector.enable", "params": {}}),
    ];
    for cmd in enable_cmds.iter() {
        ws_stream.send(tokio_tungstenite::tungstenite::Message::Text(cmd.to_string().into()))
            .await
            .map_err(|e| format!("Failed to send enable command: {}", e))?;
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
