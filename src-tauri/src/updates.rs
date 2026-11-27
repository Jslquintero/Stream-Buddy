use crate::{Studio, message};
use std::{sync::atomic::Ordering, time::Duration};
use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};
use tauri_plugin_updater::UpdaterExt;

pub fn check(app: &AppHandle, manual: bool) {
    if app
        .state::<Studio>()
        .checking_updates
        .swap(true, Ordering::AcqRel)
    {
        return;
    }
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        if let Err(error) = check_for_update(&app, manual).await {
            message(&app, error, MessageDialogKind::Warning);
        }
        app.state::<Studio>()
            .checking_updates
            .store(false, Ordering::Release);
    });
}

async fn check_for_update(app: &AppHandle, manual: bool) -> Result<(), String> {
    if !app.config().plugins.0.contains_key("updater") {
        if manual {
            message(
                app,
                "Esta compilación local no tiene un canal de actualizaciones.",
                MessageDialogKind::Info,
            );
        }
        return Ok(());
    }
    let studio = app.state::<Studio>();
    let handle = app.clone();
    let updater = app
        .updater_builder()
        .configure_client(|client| client.connect_timeout(Duration::from_secs(10)))
        .on_before_exit(move || {
            drop(
                handle
                    .state::<Studio>()
                    .server
                    .lock()
                    .expect("server lock")
                    .take(),
            );
        })
        .build();
    let update = match updater {
        Ok(updater) => updater.check().await,
        Err(error) => Err(error),
    };
    let update = match update {
        Ok(Some(update)) => update,
        Ok(None) => {
            if manual {
                message(
                    app,
                    "Ya tienes la versión más reciente de Stream Buddy.",
                    MessageDialogKind::Info,
                );
            }
            return Ok(());
        }
        Err(error) if manual => {
            return Err(format!("No se pudieron buscar actualizaciones.\n\n{error}"));
        }
        Err(_) => return Ok(()),
    };
    let download = app
        .dialog()
        .message(format!("Stream Buddy {} está disponible.", update.version))
        .title("Actualización disponible")
        .buttons(MessageDialogButtons::OkCancelCustom(
            "Actualizar ahora".into(),
            "Más tarde".into(),
        ))
        .blocking_show();
    if !download {
        return Ok(());
    }
    let bytes = update.download(|_, _| {}, || {}).await.map_err(|error| {
        format!("No se pudo descargar o verificar la actualización.\n\n{error}")
    })?;
    let install = app.dialog()
        .message("El instalador cerrará Stream Buddy. Los overlays volverán a responder cuando se abra de nuevo. Si estás en directo, puedes instalar más tarde.")
        .title("Instalar actualización")
        .buttons(MessageDialogButtons::OkCancelCustom("Instalar".into(), "Más tarde".into()))
        .blocking_show();
    if !install {
        return Ok(());
    }
    if let Err(error) = update.install(bytes) {
        let mut server = studio.server.lock().expect("server lock");
        if server.is_none() {
            *server = Some(studio.installation.start(None).map_err(|restart_error|
                format!("No se pudo instalar la actualización.\n\n{error}\n\nNo se pudo reiniciar el servidor local.\n\n{restart_error}")
            )?);
        }
        return Err(format!("No se pudo instalar la actualización.\n\n{error}"));
    }
    Ok(())
}
