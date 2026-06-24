use std::{
    fs,
    path::{Path, PathBuf},
    time::UNIX_EPOCH,
};
use tauri::Manager;

const STORAGE_BUNDLE_FILE_NAME: &str = "dekoi-storage-bundle.json";
const DESKTOP_RUNTIME_MESSENGER_THREADS_FILE_NAME: &str = "dekoi-runtime-messenger-threads.json";
const DESKTOP_RUNTIME_RIPPLE_STATES_FILE_NAME: &str = "dekoi-runtime-ripple-states.json";
const DESKTOP_RUNTIME_MARKER: &str = "de-koi-desktop";
const MESSENGER_THREADS_ENTITY: &str = "messenger-threads";
const RIPPLE_STATES_ENTITY: &str = "ripple-states";
const LEGACY_BUBBLE_THREADS_ENTITY: &str = "bubble-threads";
const PROVIDER_SECRET_SERVICE: &str = "com.xelvanas.dekoi.provider-key";

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct HostStatus {
    app_name: &'static str,
    host_kind: &'static str,
    storage_ready: bool,
    secrets_ready: bool,
    runtime_ready: bool,
    message: String,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct StorageBundleInfo {
    path: String,
    byte_length: u64,
    updated_at_ms: Option<u64>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct StorageBundleSnapshot {
    bundle: serde_json::Value,
    path: String,
    byte_length: u64,
    updated_at_ms: Option<u64>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct ProviderSecretStatus {
    connection_id: String,
    has_secret: bool,
}

fn app_data_file_path(app: &tauri::AppHandle, file_name: &str) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|dir| dir.join(file_name))
        .map_err(|error| format!("Could not resolve DeKoi app data directory. {error}"))
}

fn storage_bundle_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app_data_file_path(app, STORAGE_BUNDLE_FILE_NAME)
}

fn runtime_entity_file_name(entity: &str) -> Result<&'static str, String> {
    match entity {
        MESSENGER_THREADS_ENTITY => Ok(DESKTOP_RUNTIME_MESSENGER_THREADS_FILE_NAME),
        RIPPLE_STATES_ENTITY => Ok(DESKTOP_RUNTIME_RIPPLE_STATES_FILE_NAME),
        _ => Err(format!(
            "Desktop runtime storage entity is not supported: {entity}"
        )),
    }
}

fn runtime_entity_path(app: &tauri::AppHandle, entity: &str) -> Result<PathBuf, String> {
    app_data_file_path(app, runtime_entity_file_name(entity)?)
}

fn modified_at_ms(metadata: &fs::Metadata) -> Option<u64> {
    metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis() as u64)
}

fn bundle_info(path: PathBuf) -> Result<StorageBundleInfo, String> {
    let metadata = fs::metadata(&path)
        .map_err(|error| format!("Could not inspect DeKoi storage bundle. {error}"))?;

    Ok(StorageBundleInfo {
        path: path.to_string_lossy().into_owned(),
        byte_length: metadata.len(),
        updated_at_ms: modified_at_ms(&metadata),
    })
}

fn safe_default_bundle_file_name(file_name: Option<String>) -> String {
    let fallback = "dekoi-bundle.json";
    let Some(raw_file_name) = file_name else {
        return fallback.to_string();
    };

    let trimmed = raw_file_name.trim();
    if trimmed.is_empty() {
        return fallback.to_string();
    }

    Path::new(trimmed)
        .file_name()
        .and_then(|value| value.to_str())
        .filter(|value| !value.trim().is_empty())
        .unwrap_or(fallback)
        .to_string()
}

fn with_json_extension(mut path: PathBuf) -> PathBuf {
    if path.extension().is_none() {
        path.set_extension("json");
    }

    path
}

fn write_bundle_file(path: &Path, bundle: &serde_json::Value) -> Result<StorageBundleInfo, String> {
    let contents = serde_json::to_string_pretty(bundle)
        .map_err(|error| format!("Could not serialize DeKoi storage bundle. {error}"))?;
    let temporary_path = path.with_extension("json.tmp");

    fs::write(&temporary_path, contents)
        .map_err(|error| format!("Could not write DeKoi bundle file. {error}"))?;

    if path.exists() {
        fs::remove_file(path)
            .map_err(|error| format!("Could not replace DeKoi bundle file. {error}"))?;
    }

    fs::rename(&temporary_path, path)
        .map_err(|error| format!("Could not save DeKoi bundle file. {error}"))?;

    let _ = fs::OpenOptions::new()
        .append(true)
        .open(path)
        .and_then(|file| {
            file.sync_all()?;
            Ok(())
        });

    bundle_info(path.to_path_buf())
}

fn write_json_file(path: &Path, value: &serde_json::Value) -> Result<(), String> {
    if let Some(directory) = path.parent() {
        fs::create_dir_all(directory)
            .map_err(|error| format!("Could not create DeKoi runtime directory. {error}"))?;
    }

    let contents = serde_json::to_string_pretty(value)
        .map_err(|error| format!("Could not serialize DeKoi runtime data. {error}"))?;
    let temporary_path = path.with_extension("json.tmp");
    fs::write(&temporary_path, contents)
        .map_err(|error| format!("Could not write DeKoi runtime data. {error}"))?;

    if path.exists() {
        fs::remove_file(path)
            .map_err(|error| format!("Could not replace DeKoi runtime data. {error}"))?;
    }

    fs::rename(&temporary_path, path)
        .map_err(|error| format!("Could not save DeKoi runtime data. {error}"))
}

fn read_runtime_records(
    app: &tauri::AppHandle,
    entity: &str,
) -> Result<Vec<serde_json::Value>, String> {
    let path = runtime_entity_path(app, entity)?;
    if !path.exists() {
        return Ok(Vec::new());
    }

    let contents = fs::read_to_string(&path)
        .map_err(|error| format!("Could not read desktop runtime storage. {error}"))?;
    let value: serde_json::Value = serde_json::from_str(&contents)
        .map_err(|error| format!("Desktop runtime storage is not valid JSON. {error}"))?;

    Ok(value.as_array().cloned().unwrap_or_default())
}

fn write_runtime_records(
    app: &tauri::AppHandle,
    entity: &str,
    records: Vec<serde_json::Value>,
) -> Result<(), String> {
    let path = runtime_entity_path(app, entity)?;
    write_json_file(&path, &serde_json::Value::Array(records))
}

fn read_string_field<'a>(value: &'a serde_json::Value, key: &str) -> &'a str {
    value
        .get(key)
        .and_then(|field| field.as_str())
        .unwrap_or("")
}

fn runtime_args_object<'a>(
    args: &'a serde_json::Value,
    command: &str,
) -> Result<&'a serde_json::Map<String, serde_json::Value>, String> {
    args.as_object()
        .ok_or_else(|| format!("{command} requires args."))
}

fn runtime_entity(args: &serde_json::Map<String, serde_json::Value>) -> Result<&str, String> {
    let entity = args
        .get("entity")
        .and_then(|value| value.as_str())
        .unwrap_or("")
        .trim();
    if entity.is_empty() {
        return Err("Storage command requires args.entity.".to_string());
    }

    Ok(entity)
}

fn storage_list(
    app: &tauri::AppHandle,
    args: &serde_json::Value,
) -> Result<serde_json::Value, String> {
    let args = runtime_args_object(args, "storage_list")?;
    let entity = runtime_entity(args)?;
    if entity == LEGACY_BUBBLE_THREADS_ENTITY {
        return Ok(serde_json::Value::Array(Vec::new()));
    }

    Ok(serde_json::Value::Array(read_runtime_records(app, entity)?))
}

fn storage_create(
    app: &tauri::AppHandle,
    args: &serde_json::Value,
) -> Result<serde_json::Value, String> {
    let args = runtime_args_object(args, "storage_create")?;
    let entity = runtime_entity(args)?;
    let _ = runtime_entity_file_name(entity)?;
    let value = args
        .get("value")
        .and_then(|value| value.as_object())
        .ok_or_else(|| "storage_create requires args.value.".to_string())?;
    let mut record = value.clone();
    let id = record
        .get("id")
        .and_then(|value| value.as_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
        .unwrap_or_else(|| format!("desktop-runtime-record-{}", current_unix_ms()));
    record.insert("id".to_string(), serde_json::Value::String(id.clone()));

    let next_record = serde_json::Value::Object(record);
    let mut records = read_runtime_records(app, entity)?;
    records.retain(|record| read_string_field(record, "id") != id);
    records.push(next_record.clone());
    write_runtime_records(app, entity, records)?;

    Ok(next_record)
}

fn storage_update(
    app: &tauri::AppHandle,
    args: &serde_json::Value,
) -> Result<serde_json::Value, String> {
    let args = runtime_args_object(args, "storage_update")?;
    let entity = runtime_entity(args)?;
    let _ = runtime_entity_file_name(entity)?;
    let id = args
        .get("id")
        .and_then(|value| value.as_str())
        .unwrap_or("")
        .trim();
    if id.is_empty() {
        return Err("storage_update requires args.id.".to_string());
    }
    let patch = args
        .get("patch")
        .and_then(|value| value.as_object())
        .ok_or_else(|| "storage_update requires args.patch.".to_string())?;

    let mut records = read_runtime_records(app, entity)?;
    let existing = records
        .iter()
        .find(|record| read_string_field(record, "id") == id)
        .and_then(|record| record.as_object())
        .cloned()
        .unwrap_or_default();
    let mut record = existing;
    for (key, value) in patch {
        record.insert(key.clone(), value.clone());
    }
    record.insert("id".to_string(), serde_json::Value::String(id.to_string()));
    let next_record = serde_json::Value::Object(record);

    records.retain(|record| read_string_field(record, "id") != id);
    records.push(next_record.clone());
    write_runtime_records(app, entity, records)?;

    Ok(next_record)
}

fn storage_delete(
    app: &tauri::AppHandle,
    args: &serde_json::Value,
) -> Result<serde_json::Value, String> {
    let args = runtime_args_object(args, "storage_delete")?;
    let entity = runtime_entity(args)?;
    let _ = runtime_entity_file_name(entity)?;
    let id = args
        .get("id")
        .and_then(|value| value.as_str())
        .unwrap_or("")
        .trim();
    if id.is_empty() {
        return Err("storage_delete requires args.id.".to_string());
    }

    let mut records = read_runtime_records(app, entity)?;
    records.retain(|record| read_string_field(record, "id") != id);
    write_runtime_records(app, entity, records)?;

    Ok(serde_json::json!({ "ok": true }))
}

fn count_enabled_lore_entries(request: &serde_json::Value) -> usize {
    request
        .get("lorebooks")
        .and_then(|value| value.as_array())
        .map(|lorebooks| {
            lorebooks
                .iter()
                .filter_map(|lorebook| lorebook.get("entries").and_then(|value| value.as_array()))
                .flatten()
                .filter(|entry| {
                    entry.get("enabled").and_then(|value| value.as_bool()) != Some(false)
                })
                .count()
        })
        .unwrap_or(0)
}

fn select_companion(request: &serde_json::Value) -> Option<&serde_json::Value> {
    let companions = request.get("companions")?.as_array()?;
    let valid_companions: Vec<&serde_json::Value> = companions
        .iter()
        .filter(|companion| !read_string_field(companion, "id").trim().is_empty())
        .collect();
    if valid_companions.is_empty() {
        return None;
    }

    let companion_message_count = request
        .get("thread")
        .and_then(|thread| thread.get("messages"))
        .and_then(|messages| messages.as_array())
        .map(|messages| {
            messages
                .iter()
                .filter(|message| {
                    message
                        .get("author")
                        .and_then(|author| author.get("kind"))
                        .and_then(|kind| kind.as_str())
                        == Some("character")
                })
                .count()
        })
        .unwrap_or(0);

    Some(valid_companions[companion_message_count % valid_companions.len()])
}

fn current_unix_ms() -> u128 {
    std::time::SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default()
}

fn messenger_generate(args: &serde_json::Value) -> Result<serde_json::Value, String> {
    let args = runtime_args_object(args, "messenger_generate")?;
    let request = args
        .get("request")
        .ok_or_else(|| "messenger_generate requires args.request.".to_string())?;
    let request_id = read_string_field(request, "id").trim();
    if request_id.is_empty() {
        return Err("messenger_generate request requires id.".to_string());
    }
    let created_at = read_string_field(request, "createdAt");
    let created_at = if created_at.is_empty() {
        current_unix_ms().to_string()
    } else {
        created_at.to_string()
    };

    let Some(companion) = select_companion(request) else {
        return Ok(serde_json::json!({
            "schemaVersion": 1,
            "requestId": request_id,
            "providerKind": "remote-runtime",
            "createdAt": created_at,
            "messages": [],
            "warnings": ["Desktop runtime found no selected companion."]
        }));
    };

    let companion_id = read_string_field(companion, "id").trim();
    let companion_name = {
        let short_name = read_string_field(companion, "shortName").trim();
        if short_name.is_empty() {
            let display_name = read_string_field(companion, "displayName").trim();
            if display_name.is_empty() {
                "Companion"
            } else {
                display_name
            }
        } else {
            short_name
        }
    };
    let persona_name = request
        .get("activePersona")
        .map(|persona| read_string_field(persona, "displayName").trim())
        .filter(|value| !value.is_empty())
        .unwrap_or("the active persona");
    let lore_count = count_enabled_lore_entries(request);

    Ok(serde_json::json!({
        "schemaVersion": 1,
        "requestId": request_id,
        "providerKind": "remote-runtime",
        "createdAt": created_at,
        "messages": [
            {
                "characterId": companion_id,
                "body": format!(
                    "Desktop runtime reply from {companion_name}: received {persona_name} with {lore_count} enabled lore notes."
                )
            }
        ],
        "warnings": []
    }))
}

fn provider_secret_username(connection_id: &str) -> Result<String, String> {
    let trimmed = connection_id.trim();
    if trimmed.is_empty() {
        return Err("Provider connection id is required.".to_string());
    }

    Ok(format!("provider:{trimmed}"))
}

fn provider_secret_entry(connection_id: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new(
        PROVIDER_SECRET_SERVICE,
        provider_secret_username(connection_id)?.as_str(),
    )
    .map_err(|error| format!("Could not open provider key store. {error}"))
}

fn provider_secret_status_for(connection_id: String) -> Result<ProviderSecretStatus, String> {
    let entry = provider_secret_entry(&connection_id)?;
    match entry.get_password() {
        Ok(_) => Ok(ProviderSecretStatus {
            connection_id,
            has_secret: true,
        }),
        Err(keyring::Error::NoEntry) => Ok(ProviderSecretStatus {
            connection_id,
            has_secret: false,
        }),
        Err(error) => Err(format!("Could not check provider key. {error}")),
    }
}

fn provider_secret_store_is_available() -> bool {
    provider_secret_entry("host-status-probe").is_ok()
}

#[tauri::command]
fn dekoi_host_status() -> HostStatus {
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

#[tauri::command]
fn dekoi_storage_read_bundle(
    app: tauri::AppHandle,
) -> Result<Option<StorageBundleSnapshot>, String> {
    let path = storage_bundle_path(&app)?;
    if !path.exists() {
        return Ok(None);
    }

    let contents = fs::read_to_string(&path)
        .map_err(|error| format!("Could not read DeKoi storage bundle. {error}"))?;
    let bundle = serde_json::from_str(&contents)
        .map_err(|error| format!("DeKoi storage bundle is not valid JSON. {error}"))?;
    let info = bundle_info(path)?;

    Ok(Some(StorageBundleSnapshot {
        bundle,
        path: info.path,
        byte_length: info.byte_length,
        updated_at_ms: info.updated_at_ms,
    }))
}

#[tauri::command]
fn dekoi_storage_write_bundle(
    app: tauri::AppHandle,
    bundle: serde_json::Value,
) -> Result<StorageBundleInfo, String> {
    let path = storage_bundle_path(&app)?;
    let directory = path
        .parent()
        .ok_or_else(|| "Could not resolve DeKoi storage directory.".to_string())?;
    fs::create_dir_all(directory)
        .map_err(|error| format!("Could not create DeKoi storage directory. {error}"))?;

    write_bundle_file(&path, &bundle)
}

#[tauri::command]
fn dekoi_provider_secret_status(connection_id: String) -> Result<ProviderSecretStatus, String> {
    provider_secret_status_for(connection_id)
}

#[tauri::command]
fn dekoi_provider_secret_write(
    connection_id: String,
    secret: String,
) -> Result<ProviderSecretStatus, String> {
    let trimmed_secret = secret.trim();
    if trimmed_secret.is_empty() {
        return Err("Provider key cannot be empty.".to_string());
    }

    let entry = provider_secret_entry(&connection_id)?;
    entry
        .set_password(trimmed_secret)
        .map_err(|error| format!("Could not save provider key. {error}"))?;

    Ok(ProviderSecretStatus {
        connection_id,
        has_secret: true,
    })
}

#[tauri::command]
fn dekoi_provider_secret_delete(connection_id: String) -> Result<ProviderSecretStatus, String> {
    let entry = provider_secret_entry(&connection_id)?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(ProviderSecretStatus {
            connection_id,
            has_secret: false,
        }),
        Err(error) => Err(format!("Could not clear provider key. {error}")),
    }
}

#[tauri::command]
fn dekoi_file_export_bundle(
    bundle: serde_json::Value,
    default_file_name: Option<String>,
) -> Result<Option<StorageBundleInfo>, String> {
    let Some(path) = rfd::FileDialog::new()
        .add_filter("DeKoi bundle", &["json"])
        .set_file_name(safe_default_bundle_file_name(default_file_name))
        .save_file()
    else {
        return Ok(None);
    };
    let path = with_json_extension(path);

    write_bundle_file(&path, &bundle).map(Some)
}

#[tauri::command]
fn dekoi_file_import_bundle() -> Result<Option<StorageBundleSnapshot>, String> {
    let Some(path) = rfd::FileDialog::new()
        .add_filter("DeKoi bundle", &["json"])
        .pick_file()
    else {
        return Ok(None);
    };

    let contents = fs::read_to_string(&path)
        .map_err(|error| format!("Could not read DeKoi bundle file. {error}"))?;
    let bundle = serde_json::from_str(&contents)
        .map_err(|error| format!("DeKoi bundle file is not valid JSON. {error}"))?;
    let info = bundle_info(path)?;

    Ok(Some(StorageBundleSnapshot {
        bundle,
        path: info.path,
        byte_length: info.byte_length,
        updated_at_ms: info.updated_at_ms,
    }))
}

#[tauri::command]
fn dekoi_runtime_health() -> serde_json::Value {
    serde_json::json!({
        "ok": true,
        "runtime": DESKTOP_RUNTIME_MARKER,
        "writable": true
    })
}

#[tauri::command]
fn dekoi_runtime_invoke(
    app: tauri::AppHandle,
    command: String,
    args: Option<serde_json::Value>,
) -> Result<serde_json::Value, String> {
    let args = args.unwrap_or(serde_json::Value::Null);
    match command.as_str() {
        "messenger_generate" => messenger_generate(&args),
        "storage_create" => storage_create(&app, &args),
        "storage_delete" => storage_delete(&app, &args),
        "storage_list" => storage_list(&app, &args),
        "storage_update" => storage_update(&app, &args),
        _ => Err(format!(
            "Desktop runtime command is not supported: {command}"
        )),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            dekoi_host_status,
            dekoi_file_export_bundle,
            dekoi_file_import_bundle,
            dekoi_provider_secret_delete,
            dekoi_provider_secret_status,
            dekoi_provider_secret_write,
            dekoi_runtime_health,
            dekoi_runtime_invoke,
            dekoi_storage_read_bundle,
            dekoi_storage_write_bundle
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
