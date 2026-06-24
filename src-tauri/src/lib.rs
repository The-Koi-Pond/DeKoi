#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct HostStatus {
    app_name: &'static str,
    host_kind: &'static str,
    storage_ready: bool,
    secrets_ready: bool,
    runtime_ready: bool,
    message: &'static str,
}

#[tauri::command]
fn dekoi_host_status() -> HostStatus {
    HostStatus {
        app_name: "DeKoi",
        host_kind: "tauri",
        storage_ready: false,
        secrets_ready: false,
        runtime_ready: false,
        message: "Tauri host is available. Durable native storage is not wired yet.",
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![dekoi_host_status])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
