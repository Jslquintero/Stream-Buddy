#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod server;
mod updates;

use server::{ADDRESS, Installation, Server, URL};
use std::{fs, net::TcpListener, path::PathBuf, sync::Mutex};
use tauri::{
    App, AppHandle, Manager, RunEvent, WebviewUrl, WebviewWindowBuilder,
    menu::{MenuBuilder, SubmenuBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    webview::NewWindowResponse,
};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};
use tauri_plugin_opener::OpenerExt;

struct Studio {
    installation: Installation,
    server: Mutex<Option<Server>>,
    checking_updates: std::sync::atomic::AtomicBool,
}

fn message(app: &AppHandle, text: impl Into<String>, kind: MessageDialogKind) {
    app.dialog()
        .message(text)
        .title("Stream Buddy")
        .kind(kind)
        .blocking_show();
}

fn select_import(app: &AppHandle, local: &std::path::Path) -> Option<PathBuf> {
    while !local.join("data").exists() && app.dialog()
        .message("Puedes importar los perfiles, ajustes, composiciones y recursos de una instalación anterior de Stream Buddy.")
        .title("Importar datos")
        .buttons(MessageDialogButtons::OkCancelCustom("Elegir carpeta".into(), "Empezar sin importar".into()))
        .blocking_show()
    {
        if let Some(folder) = app.dialog().file().set_title("Selecciona la instalación anterior o su carpeta data").blocking_pick_folder()
            .and_then(|folder| folder.into_path().ok())
        {
            return Some(folder);
        }
    }
    None
}

fn launch(app: &AppHandle) -> Result<(), String> {
    let studio = app.state::<Studio>();
    fs::create_dir_all(&studio.installation.local).map_err(|error| error.to_string())?;
    if let Err(error) = TcpListener::bind(ADDRESS) {
        return Err(if error.kind() == std::io::ErrorKind::AddrInUse {
            "El puerto 17900 está ocupado. Cierra el programa que lo utiliza y vuelve a abrir Stream Buddy.".into()
        } else {
            error.to_string()
        });
    }
    let import = select_import(app, &studio.installation.local);
    *studio.server.lock().expect("server lock") =
        Some(studio.installation.start(import.as_deref())?);
    let url: tauri::Url = URL.parse().expect("valid panel URL");
    let origin = url.origin();
    let navigation = app.clone();
    let popups = app.clone();
    let popup_origin = origin.clone();
    WebviewWindowBuilder::new(app, "main", WebviewUrl::External(url))
        .title("Stream Buddy")
        .inner_size(1280.0, 840.0)
        .initialization_script("window.__STREAM_BUDDY_DESKTOP__ = true;")
        .data_directory(studio.installation.local.join("webview"))
        .disable_drag_drop_handler()
        .on_navigation(move |url| {
            if url.origin() == origin {
                return true;
            }
            if matches!(url.scheme(), "http" | "https") {
                let _ = navigation.opener().open_url(url.as_str(), None::<&str>);
            }
            false
        })
        .on_new_window(move |url, _| {
            if url.origin() == popup_origin || url.as_str() == "about:blank" {
                return NewWindowResponse::Allow;
            }
            if matches!(url.scheme(), "http" | "https") {
                let _ = popups.opener().open_url(url.as_str(), None::<&str>);
            }
            NewWindowResponse::Deny
        })
        .build()
        .map_err(|error| error.to_string())?;
    Ok(())
}

fn show_panel(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn setup(app: &mut App) -> Result<(), Box<dyn std::error::Error>> {
    let executable = std::env::current_exe()?;
    let local = app.path().local_data_dir()?.join("Stream Buddy");
    app.manage(Studio {
        installation: Installation {
            bin: executable
                .parent()
                .expect("executable directory")
                .to_path_buf(),
            app: app.path().resource_dir()?.join("app"),
            local,
        },
        server: Mutex::new(None),
        checking_updates: false.into(),
    });
    let menu = SubmenuBuilder::new(app, "Stream Buddy")
        .text("updates", "Buscar actualizaciones")
        .separator()
        .text("quit", "Salir")
        .build()?;
    app.set_menu(MenuBuilder::new(app).item(&menu).build()?)?;
    let tray_menu = MenuBuilder::new(app)
        .text("show", "Abrir Stream Buddy")
        .separator()
        .text("quit", "Salir")
        .build()?;
    TrayIconBuilder::new()
        .icon(app.default_window_icon().ok_or("Falta el icono de Stream Buddy")?.clone())
        .tooltip("Stream Buddy")
        .menu(&tray_menu)
        .show_menu_on_left_click(false)
        .on_tray_icon_event(|tray, event| {
            if matches!(event, TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. }) {
                show_panel(tray.app_handle());
            }
        })
        .build(app)?;
    let handle = app.handle().clone();
    std::thread::spawn(move || match launch(&handle) {
        Ok(()) => updates::check(&handle, false),
        Err(error) => {
            message(
                &handle,
                format!("No se pudo abrir Stream Buddy.\n\n{error}"),
                MessageDialogKind::Error,
            );
            handle.exit(1);
        }
    });
    Ok(())
}

fn main() {
    let context = tauri::generate_context!();
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            show_panel(app);
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init());
    let builder = if context.config().plugins.0.contains_key("updater") {
        builder.plugin(tauri_plugin_updater::Builder::new().build())
    } else {
        builder
    };
    builder
        .setup(setup)
        .on_window_event(|window, event| {
            if window.label() == "main" {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    if window.hide().is_ok() {
                        api.prevent_close();
                    }
                }
            }
        })
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show" => show_panel(app),
            "updates" => updates::check(app, true),
            "quit" => app.exit(0),
            _ => {}
        })
        .build(context)
        .expect("could not initialize Stream Buddy")
        .run(|app, event| {
            if let RunEvent::Exit = event {
                drop(
                    app.state::<Studio>()
                        .server
                        .lock()
                        .expect("server lock")
                        .take(),
                );
            }
        });
}
