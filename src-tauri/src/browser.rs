use tauri::Window;
use crate::cdp_ws::connect_cdp_ws;

#[derive(Clone)]
pub struct BrowserManager {
    window: Window,
}

impl BrowserManager {
    pub async fn new(window: Window) -> Result<Self, Box<dyn std::error::Error>> {
        Ok(Self { window })
    }

    pub async fn connect(&self, ws_url: &str) -> Result<(), Box<dyn std::error::Error>> {
        connect_cdp_ws(self.window.clone(), ws_url).await
    }
}