use chrono::{SecondsFormat, Utc};
use std::{
    collections::HashSet,
    fs,
    path::{Path, PathBuf},
    time::UNIX_EPOCH,
};
use tauri::Manager;

const STORAGE_BUNDLE_FILE_NAME: &str = "dekoi-storage-bundle.json";
const APP_SETTINGS_ENTITY: &str = "app-settings";
const CHARACTERS_ENTITY: &str = "characters";
const ROLEPLAY_THREADS_ENTITY: &str = "roleplay-threads";
const LOREBOOKS_ENTITY: &str = "lorebooks";
const MESSENGER_THREADS_ENTITY: &str = "messenger-threads";
const PERSONAS_ENTITY: &str = "personas";
const PROVIDER_CONNECTIONS_ENTITY: &str = "provider-connections";
const RIPPLE_STATES_ENTITY: &str = "ripple-states";
const LEGACY_BUBBLE_THREADS_ENTITY: &str = "bubble-threads";
const COLLECTION_ENTITIES: &[&str] = &[
    APP_SETTINGS_ENTITY,
    CHARACTERS_ENTITY,
    ROLEPLAY_THREADS_ENTITY,
    LOREBOOKS_ENTITY,
    MESSENGER_THREADS_ENTITY,
    PERSONAS_ENTITY,
    PROVIDER_CONNECTIONS_ENTITY,
    RIPPLE_STATES_ENTITY,
];

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct StorageBundleInfo {
    pub(crate) path: String,
    pub(crate) byte_length: u64,
    pub(crate) updated_at_ms: Option<u64>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct StorageBundleSnapshot {
    pub(crate) bundle: serde_json::Value,
    pub(crate) path: String,
    pub(crate) byte_length: u64,
    pub(crate) updated_at_ms: Option<u64>,
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

fn ensure_collection_entity(entity: &str) -> Result<(), String> {
    if COLLECTION_ENTITIES.contains(&entity) {
        return Ok(());
    }

    Err(format!(
        "Desktop runtime storage entity is not supported: {entity}"
    ))
}

fn runtime_entity_path(app: &tauri::AppHandle, entity: &str) -> Result<PathBuf, String> {
    ensure_collection_entity(entity)?;
    app.path()
        .app_data_dir()
        .map(|dir| dir.join("collections").join(format!("{entity}.json")))
        .map_err(|error| format!("Could not resolve DeKoi app data directory. {error}"))
}

fn modified_at_ms(metadata: &fs::Metadata) -> Option<u64> {
    metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis() as u64)
}

pub(crate) fn bundle_info(path: PathBuf) -> Result<StorageBundleInfo, String> {
    let metadata = fs::metadata(&path)
        .map_err(|error| format!("Could not inspect DeKoi storage bundle. {error}"))?;

    Ok(StorageBundleInfo {
        path: path.to_string_lossy().into_owned(),
        byte_length: metadata.len(),
        updated_at_ms: modified_at_ms(&metadata),
    })
}

pub(crate) fn write_bundle_file(
    path: &Path,
    bundle: &serde_json::Value,
) -> Result<StorageBundleInfo, String> {
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

pub(crate) fn read_string_field<'a>(value: &'a serde_json::Value, key: &str) -> &'a str {
    value
        .get(key)
        .and_then(|field| field.as_str())
        .unwrap_or("")
}

pub(crate) fn runtime_args_object<'a>(
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

pub(crate) fn storage_list(
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

pub(crate) fn storage_create(
    app: &tauri::AppHandle,
    args: &serde_json::Value,
) -> Result<serde_json::Value, String> {
    let args = runtime_args_object(args, "storage_create")?;
    let entity = runtime_entity(args)?;
    ensure_collection_entity(entity)?;
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
    let now = current_iso_timestamp();
    record.insert("id".to_string(), serde_json::Value::String(id.clone()));
    record
        .entry("createdAt".to_string())
        .or_insert_with(|| serde_json::Value::String(now.clone()));
    record.insert("updatedAt".to_string(), serde_json::Value::String(now));

    let next_record = serde_json::Value::Object(record);
    let mut records = read_runtime_records(app, entity)?;
    records.retain(|record| read_string_field(record, "id") != id);
    records.push(next_record.clone());
    write_runtime_records(app, entity, records)?;

    Ok(next_record)
}

pub(crate) fn storage_update(
    app: &tauri::AppHandle,
    args: &serde_json::Value,
) -> Result<serde_json::Value, String> {
    let args = runtime_args_object(args, "storage_update")?;
    let entity = runtime_entity(args)?;
    ensure_collection_entity(entity)?;
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
    record.insert(
        "updatedAt".to_string(),
        serde_json::Value::String(current_iso_timestamp()),
    );
    let next_record = serde_json::Value::Object(record);

    records.retain(|record| read_string_field(record, "id") != id);
    records.push(next_record.clone());
    write_runtime_records(app, entity, records)?;

    Ok(next_record)
}

pub(crate) fn storage_delete(
    app: &tauri::AppHandle,
    args: &serde_json::Value,
) -> Result<serde_json::Value, String> {
    let args = runtime_args_object(args, "storage_delete")?;
    let entity = runtime_entity(args)?;
    ensure_collection_entity(entity)?;
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

pub(crate) fn storage_replace(
    app: &tauri::AppHandle,
    args: &serde_json::Value,
) -> Result<serde_json::Value, String> {
    let args = runtime_args_object(args, "storage_replace")?;
    let entity = runtime_entity(args)?;
    ensure_collection_entity(entity)?;
    let records = args
        .get("records")
        .and_then(|value| value.as_array())
        .ok_or_else(|| "storage_replace requires args.records.".to_string())?;

    let mut ids = HashSet::new();
    for record in records {
        let Some(record) = record.as_object() else {
            return Err("storage_replace records must be objects.".to_string());
        };

        let id = record
            .get("id")
            .and_then(|value| value.as_str())
            .unwrap_or("")
            .trim();
        if id.is_empty() {
            return Err("storage_replace records require id.".to_string());
        }
        if !ids.insert(id.to_string()) {
            return Err("storage_replace records require unique ids.".to_string());
        }
    }

    let count = records.len();
    write_runtime_records(app, entity, records.clone())?;

    Ok(serde_json::json!({ "ok": true, "count": count }))
}

pub(crate) fn current_unix_ms() -> u128 {
    std::time::SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default()
}

pub(crate) fn current_iso_timestamp() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)
}

#[tauri::command]
pub(crate) fn dekoi_storage_read_bundle(
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
pub(crate) fn dekoi_storage_write_bundle(
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
