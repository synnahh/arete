// ─── VALERIE — Tauri application entry point ──────────────────────────────────
// System tray, minimize-to-tray on close, launch on startup

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // ── Plugins ──────────────────────────────────────────────────────────
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
            let quit_item = MenuItem::with_id(app, "quit", "Quit",         true, None::<&str>)?;
            let menu      = Menu::with_items(app, &[&show_item, &quit_item])?;

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
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;

            Ok(())
        })

        .invoke_handler(tauri::generate_handler![])
        .run(tauri::generate_context!())
        .expect("error while running VALERIE");
}
