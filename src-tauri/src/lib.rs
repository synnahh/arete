// ─── VALERIE — Tauri application entry point ──────────────────────────────────
// System tray, minimize-to-tray on close, launch on startup

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use keyring::Entry;
use tauri_plugin_updater::UpdaterExt;

const OLLAMA_BASE: &str = "http://127.0.0.1:11434";

#[derive(Serialize, Deserialize)]
struct OllamaMessage {
    role: String,
    content: String,
}

// Ping Ollama via Rust — bypasses WebView plugin restrictions on localhost HTTP
#[tauri::command]
async fn ping_ollama() -> bool {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(3))
        .build()
        .unwrap_or_default();
    client
        .get(format!("{}/api/tags", OLLAMA_BASE))
        .send()
        .await
        .map(|r| r.status().is_success())
        .unwrap_or(false)
}

// Chat with Ollama via Rust
#[tauri::command]
async fn ask_ollama(messages: Vec<OllamaMessage>, model: String) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| e.to_string())?;

    let body = serde_json::json!({
        "model": model,
        "messages": messages,
        "stream": false,
    });

    let res = client
        .post(format!("{}/api/chat", OLLAMA_BASE))
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(format!("Ollama error {}", res.status()));
    }

    let data: Value = res.json().await.map_err(|e| e.to_string())?;
    Ok(data["message"]["content"].as_str().unwrap_or("").to_string())
}

#[tauri::command]
fn launch_ollama() {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let _ = std::process::Command::new("ollama")
            .arg("serve")
            .creation_flags(0x08000000) // CREATE_NO_WINDOW — no terminal popup
            .spawn();
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = std::process::Command::new("ollama")
            .arg("serve")
            .spawn();
    }
}

// Store a secret in the OS keychain (Windows Credential Manager / macOS Keychain)
#[tauri::command]
fn store_secret(service: String, key: String, value: String) -> Result<(), String> {
    Entry::new(&service, &key)
        .map_err(|e| e.to_string())?
        .set_password(&value)
        .map_err(|e| e.to_string())
}

// Retrieve a secret from the OS keychain; returns null if not found
#[tauri::command]
fn get_secret(service: String, key: String) -> Result<Option<String>, String> {
    let entry = Entry::new(&service, &key).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(pw) => Ok(Some(pw)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

// ─── Updater ──────────────────────────────────────────────────────────────────

#[derive(Serialize)]
struct UpdateInfo {
    available: bool,
    version:   Option<String>,
    notes:     Option<String>,
}

/// Check if a new version is available. Returns { available, version, notes }.
#[tauri::command]
async fn check_for_update(app: tauri::AppHandle) -> Result<UpdateInfo, String> {
    let updater = app.updater_builder()
        .build()
        .map_err(|e| e.to_string())?;

    match updater.check().await {
        Ok(Some(update)) => Ok(UpdateInfo {
            available: true,
            version:   Some(update.version.clone()),
            notes:     update.body.clone(),
        }),
        Ok(None) => Ok(UpdateInfo { available: false, version: None, notes: None }),
        Err(e)   => Err(e.to_string()),
    }
}

/// Download and install the pending update. App will restart automatically.
#[tauri::command]
async fn install_update(app: tauri::AppHandle) -> Result<(), String> {
    let updater = app.updater_builder()
        .build()
        .map_err(|e| e.to_string())?;

    if let Some(update) = updater.check().await.map_err(|e| e.to_string())? {
        update.download_and_install(|_, _| {}, || {})
            .await
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // ── WebView2 GPU / black-screen fixes ────────────────────────────────────
    // Must be set BEFORE tauri::Builder::default() creates the WebView.
    //
    // --in-process-gpu
    //   Runs the GPU pipeline in the browser process instead of a separate GPU
    //   process. Fixes white screen when the external GPU process dies on alt-tab.
    //
    // --disable-gpu-sandbox
    //   Disables the GPU sandbox so the in-process GPU can access DirectX.
    //
    // --disable-features=CalculateNativeWinOcclusion
    //   KEY FIX for black screen when Chrome is running alongside VALERIE.
    //   Chromium normally detects when another window (Chrome) covers it and
    //   suspends the GPU swap chain to save resources. When you alt-tab back,
    //   the swap chain is invalid → black frame. This flag disables that
    //   occlusion calculation entirely, keeping the swap chain alive.
    //
    // --disable-features=msHiddenComposition
    //   Disables a Windows-specific DirectComposition optimisation that can
    //   cause WebView2 to enter a zero-opacity state when occluded by Chrome.
    #[cfg(target_os = "windows")]
    {
        std::env::set_var(
            "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
            "--in-process-gpu --disable-gpu-sandbox \
             --disable-features=CalculateNativeWinOcclusion,msHiddenComposition",
        );
    }

    tauri::Builder::default()
        // ── Plugins ──────────────────────────────────────────────────────────
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))

        // ── Close → hide to tray (builder-level, avoids Send issues) ─────────
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })

        // ── Setup: tray icon ──────────────────────────────────────────────────
        .setup(|app| {
            let show_item = MenuItem::with_id(app, "show", "Show VALERIE", true, None::<&str>)?;
            let hide_item = MenuItem::with_id(app, "hide", "Hide VALERIE", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit",         true, None::<&str>)?;
            let menu      = Menu::with_items(app, &[&show_item, &hide_item, &quit_item])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("VALERIE")
                .menu(&menu)
                .show_menu_on_left_click(false)
                // Left-click tray icon → show & focus window
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let handle = tray.app_handle();
                        if let Some(window) = handle.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                // Tray menu actions
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "hide" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.hide();
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;

            Ok(())
        })

        .invoke_handler(tauri::generate_handler![launch_ollama, ping_ollama, ask_ollama, store_secret, get_secret, check_for_update, install_update])
        .run(tauri::generate_context!())
        .expect("error while running VALERIE");
}
