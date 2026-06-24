use crate::secrets::provider_secret_store_is_available;

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct HostStatus {
    app_name: &'static str,
    host_kind: &'static str,
    storage_ready: bool,
    secrets_ready: bool,
    runtime_ready: bool,
    message: String,
}

#[tauri::command]
pub(crate) fn dekoi_host_status() -> HostStatus {
    let secrets_ready = provider_secret_store_is_available();

    HostStatus {
        app_name: "DeKoi",
        host_kind: "tauri",
        storage_ready: true,
        secrets_ready,
        runtime_ready: true,
        message: if secrets_ready {
            "Tauri host is available. Storage, provider keys, and desktop runtime are ready."
        } else {
            "Tauri host is available. Storage and desktop runtime are ready, but provider key storage is unavailable."
        }
        .to_string(),
    }
}
