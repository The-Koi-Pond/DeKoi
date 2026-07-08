mod file_dialog;
mod host;
mod provider_response;
mod provider_transport;
mod runtime;
mod runtime_args;
mod secrets;
mod storage;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(
            tauri_plugin_window_state::Builder::new()
                .with_state_flags(
                    tauri_plugin_window_state::StateFlags::POSITION
                        | tauri_plugin_window_state::StateFlags::SIZE
                        | tauri_plugin_window_state::StateFlags::MAXIMIZED
                        | tauri_plugin_window_state::StateFlags::VISIBLE
                        | tauri_plugin_window_state::StateFlags::FULLSCREEN,
                )
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            host::dekoi_host_status,
            file_dialog::dekoi_file_export_bundle,
            file_dialog::dekoi_file_import_bundle,
            secrets::dekoi_provider_secret_delete,
            secrets::dekoi_provider_secret_status,
            secrets::dekoi_provider_secret_write,
            runtime::dekoi_runtime_health,
            runtime::dekoi_runtime_invoke,
            storage::dekoi_storage_read_bundle,
            storage::dekoi_storage_write_bundle,
            storage::dekoi_storage_repair_collection,
            storage::dekoi_storage_finish_collection_repair,
            storage::dekoi_storage_collection_metadata
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
