use crate::provider_transport::{
    generation_generate, provider_connection_check, provider_connection_models,
};
use crate::storage::{
    storage_create, storage_delete, storage_list, storage_replace, storage_update,
};

const DESKTOP_RUNTIME_MARKER: &str = "de-koi-desktop";

#[tauri::command]
pub(crate) fn dekoi_runtime_health() -> serde_json::Value {
    serde_json::json!({
        "ok": true,
        "runtime": DESKTOP_RUNTIME_MARKER,
        "writable": true
    })
}

#[tauri::command]
pub(crate) async fn dekoi_runtime_invoke(
    app: tauri::AppHandle,
    command: String,
    args: Option<serde_json::Value>,
) -> Result<serde_json::Value, String> {
    let args = args.unwrap_or(serde_json::Value::Null);
    match command.as_str() {
        "generation_generate" => generation_generate(&args).await,
        "provider_connection_check" => provider_connection_check(&args).await,
        "provider_connection_models" => provider_connection_models(&args).await,
        "storage_create" => storage_create(&app, &args),
        "storage_delete" => storage_delete(&app, &args),
        "storage_list" => storage_list(&app, &args),
        "storage_replace" => storage_replace(&app, &args),
        "storage_update" => storage_update(&app, &args),
        _ => Err(format!(
            "Desktop runtime command is not supported: {command}"
        )),
    }
}
