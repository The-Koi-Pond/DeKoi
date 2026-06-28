use chrono::{SecondsFormat, Utc};
use std::{
    collections::HashSet,
    fs::{self, File},
    io::{self, Write},
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
    write_bundle_json_file(path, bundle, "bundle file")?;
    bundle_info(path.to_path_buf())
}

fn temporary_json_path(path: &Path) -> PathBuf {
    path.with_extension("json.tmp")
}

fn backup_json_path(path: &Path) -> PathBuf {
    path.with_extension("json.bak")
}

fn backup_exists(path: &Path) -> bool {
    backup_json_path(path).exists()
}

fn temporary_json_exists(path: &Path) -> bool {
    temporary_json_path(path).exists()
}

fn recovery_artifacts_exist(path: &Path) -> bool {
    backup_exists(path) || temporary_json_exists(path)
}

fn yes_no(value: bool) -> &'static str {
    if value {
        "yes"
    } else {
        "no"
    }
}

fn sync_file_best_effort(path: &Path) {
    let _ = fs::OpenOptions::new()
        .read(true)
        .open(path)
        .and_then(|file| file.sync_all());
}

fn sync_parent_directory_best_effort(path: &Path) {
    if let Some(directory) = path.parent() {
        // Best-effort: std directory handles are not portable across supported OSes.
        let _ = File::open(directory).and_then(|file| file.sync_all());
    }
}

enum BackupState {
    NotRequested,
    NoSourceFile,
    Created { path: PathBuf },
}

impl BackupState {
    fn can_remove_target_for_retry(&self) -> bool {
        matches!(
            self,
            BackupState::NotRequested | BackupState::Created { .. }
        )
    }

    fn created(&self) -> bool {
        matches!(self, BackupState::Created { .. })
    }
}

fn preserve_existing_backup(
    path: &Path,
    path_category: &str,
    preserve_backup: bool,
) -> Result<BackupState, String> {
    if !preserve_backup {
        return Ok(BackupState::NotRequested);
    }

    if !path.exists() {
        return Ok(BackupState::NoSourceFile);
    }

    let backup_path = backup_json_path(path);
    fs::copy(path, &backup_path).map_err(|error| {
        format!("Could not create DeKoi JSON backup before writing {path_category}. {error}")
    })?;
    sync_file_best_effort(&backup_path);
    sync_parent_directory_best_effort(&backup_path);

    Ok(BackupState::Created { path: backup_path })
}

fn install_temporary_json_file(
    temporary_path: &Path,
    path: &Path,
    backup_state: &BackupState,
) -> io::Result<()> {
    match fs::rename(temporary_path, path) {
        Ok(()) => Ok(()),
        Err(first_error) => {
            if !backup_state.can_remove_target_for_retry() {
                return Err(io::Error::new(
                    first_error.kind(),
                    format!("no recorded backup existed before replacement: {first_error}"),
                ));
            }

            if let Err(remove_error) = fs::remove_file(path) {
                return if remove_error.kind() == io::ErrorKind::NotFound {
                    Err(first_error)
                } else {
                    Err(remove_error)
                };
            }
            fs::rename(temporary_path, path)
        }
    }
}

fn restore_backup_from_path(backup_path: &Path, path: &Path) -> Result<(), String> {
    fs::copy(backup_path, path)
        .map_err(|error| format!("Could not restore DeKoi JSON backup. {error}"))?;
    sync_file_best_effort(path);
    sync_parent_directory_best_effort(path);
    Ok(())
}

fn restore_created_backup(path: &Path, backup_state: &BackupState) -> String {
    let BackupState::Created { path: backup_path } = backup_state else {
        return " No recorded backup was available to restore.".to_string();
    };

    match restore_backup_from_path(backup_path, path) {
        Ok(()) => " Restored recorded backup.".to_string(),
        Err(restore_error) => format!(" Restore failed: {restore_error}"),
    }
}

struct TemporaryJsonCleanup {
    path: PathBuf,
}

impl TemporaryJsonCleanup {
    fn new(path: PathBuf) -> Self {
        Self { path }
    }

    fn cleanup(&self) -> Result<(), String> {
        match fs::remove_file(&self.path) {
            Ok(()) => Ok(()),
            Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(()),
            Err(error) => Err(format!("Could not remove DeKoi JSON temp file. {error}")),
        }
    }
}

impl Drop for TemporaryJsonCleanup {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.path);
    }
}

fn write_bundle_json_file(
    path: &Path,
    value: &serde_json::Value,
    path_category: &str,
) -> Result<(), String> {
    write_json_file_with_installer(
        path,
        value,
        path_category,
        false,
        install_temporary_json_file,
    )
}

fn write_collection_json_file(
    path: &Path,
    value: &serde_json::Value,
    path_category: &str,
) -> Result<(), String> {
    write_json_file_with_installer(
        path,
        value,
        path_category,
        true,
        install_temporary_json_file,
    )
}

fn write_json_file_with_installer<F>(
    path: &Path,
    value: &serde_json::Value,
    path_category: &str,
    preserve_backup: bool,
    installer: F,
) -> Result<(), String>
where
    F: FnOnce(&Path, &Path, &BackupState) -> io::Result<()>,
{
    if let Some(directory) = path.parent() {
        fs::create_dir_all(directory)
            .map_err(|error| format!("Could not create DeKoi runtime directory. {error}"))?;
    }

    let backup_state = preserve_existing_backup(path, path_category, preserve_backup)?;

    let contents = serde_json::to_string_pretty(value)
        .map_err(|error| format!("Could not serialize DeKoi runtime data. {error}"))?;
    let temporary_path = temporary_json_path(path);
    let temporary_cleanup = TemporaryJsonCleanup::new(temporary_path.clone());
    {
        let mut temporary_file = File::create(&temporary_path)
            .map_err(|error| format!("Could not write DeKoi runtime data. {error}"))?;
        temporary_file
            .write_all(contents.as_bytes())
            .map_err(|error| format!("Could not write DeKoi runtime data. {error}"))?;
        temporary_file
            .sync_all()
            .map_err(|error| format!("Could not sync DeKoi runtime data. {error}"))?;
    }

    let install_result = installer(&temporary_path, path, &backup_state);
    let cleanup_result = temporary_cleanup.cleanup();

    if let Err(error) = install_result {
        let cleanup_message = cleanup_result
            .err()
            .map(|cleanup_error| format!(" Temp cleanup failed: {cleanup_error}."))
            .unwrap_or_default();
        let restore_message = restore_created_backup(path, &backup_state);
        return Err(format!(
            "Could not save DeKoi JSON data (path category: {path_category}; backup created: {}). {error}.{cleanup_message}{restore_message}",
            yes_no(backup_state.created()),
        ));
    }

    sync_file_best_effort(path);
    sync_parent_directory_best_effort(path);
    cleanup_result?;

    Ok(())
}

fn collection_file_error(entity: &str, path: &Path, reason: String) -> String {
    format!(
        "Desktop runtime storage collection '{entity}' could not be loaded (path category: collection file; backup exists: {}; temp exists: {}; writes blocked: yes). {reason}",
        yes_no(backup_exists(path)),
        yes_no(temporary_json_exists(path)),
    )
}

enum CollectionFileState {
    MissingClean,
    MissingWithRecovery,
    EmptyClean,
    EmptyWithRecovery,
    Records(Vec<serde_json::Value>),
    InvalidJson(String),
    NonArray,
    ReadFailure(String),
}

fn classify_collection_file(path: &Path) -> CollectionFileState {
    if !path.exists() {
        return if recovery_artifacts_exist(path) {
            CollectionFileState::MissingWithRecovery
        } else {
            CollectionFileState::MissingClean
        };
    }

    let contents = match fs::read_to_string(path) {
        Ok(contents) => contents,
        Err(error) => return CollectionFileState::ReadFailure(error.to_string()),
    };
    if contents.trim().is_empty() {
        return if recovery_artifacts_exist(path) {
            CollectionFileState::EmptyWithRecovery
        } else {
            CollectionFileState::EmptyClean
        };
    }

    match serde_json::from_str::<serde_json::Value>(&contents) {
        Ok(serde_json::Value::Array(records)) => CollectionFileState::Records(records),
        Ok(_) => CollectionFileState::NonArray,
        Err(error) => CollectionFileState::InvalidJson(error.to_string()),
    }
}

fn collection_file_state_error_reason(state: &CollectionFileState) -> Option<String> {
    match state {
        CollectionFileState::MissingClean | CollectionFileState::Records(_) => None,
        CollectionFileState::MissingWithRecovery => {
            Some("Collection file is missing but recovery artifacts exist.".to_string())
        }
        CollectionFileState::EmptyClean => Some("Collection file is empty.".to_string()),
        CollectionFileState::EmptyWithRecovery => {
            Some("Collection file is empty and recovery artifacts exist.".to_string())
        }
        CollectionFileState::InvalidJson(error) => {
            Some(format!("Collection file is not valid JSON. {error}"))
        }
        CollectionFileState::NonArray => {
            Some("Collection file must contain a JSON array.".to_string())
        }
        CollectionFileState::ReadFailure(error) => {
            Some(format!("Could not read collection file. {error}"))
        }
    }
}

fn ensure_collection_file_is_usable(
    path: &Path,
    entity: &str,
) -> Result<CollectionFileState, String> {
    let state = classify_collection_file(path);
    if let Some(reason) = collection_file_state_error_reason(&state) {
        return Err(collection_file_error(entity, path, reason));
    }

    Ok(state)
}

fn read_collection_records_from_path(
    path: &Path,
    entity: &str,
) -> Result<Vec<serde_json::Value>, String> {
    match ensure_collection_file_is_usable(path, entity)? {
        CollectionFileState::MissingClean => Ok(Vec::new()),
        CollectionFileState::Records(records) => Ok(records),
        _ => Err(collection_file_error(
            entity,
            path,
            "Collection file could not be loaded.".to_string(),
        )),
    }
}

fn ensure_collection_file_can_be_overwritten(path: &Path, entity: &str) -> Result<(), String> {
    ensure_collection_file_is_usable(path, entity).map(|_| ())
}

fn read_runtime_records(
    app: &tauri::AppHandle,
    entity: &str,
) -> Result<Vec<serde_json::Value>, String> {
    let path = runtime_entity_path(app, entity)?;
    read_collection_records_from_path(&path, entity)
}

fn write_runtime_records(
    app: &tauri::AppHandle,
    entity: &str,
    records: Vec<serde_json::Value>,
) -> Result<(), String> {
    let path = runtime_entity_path(app, entity)?;
    write_runtime_records_to_path(&path, entity, records)
}

fn write_runtime_records_to_path(
    path: &Path,
    entity: &str,
    records: Vec<serde_json::Value>,
) -> Result<(), String> {
    ensure_collection_file_can_be_overwritten(path, entity)?;
    write_collection_json_file(path, &serde_json::Value::Array(records), "collection file")
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
    let mut normalized_records = Vec::with_capacity(records.len());
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

        let mut normalized_record = record.clone();
        normalized_record.insert("id".to_string(), serde_json::Value::String(id.to_string()));
        normalized_records.push(serde_json::Value::Object(normalized_record));
    }

    let count = normalized_records.len();
    write_runtime_records(app, entity, normalized_records)?;

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

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_test_dir(name: &str) -> PathBuf {
        let directory = std::env::temp_dir().join(format!(
            "dekoi-storage-{name}-{}-{}",
            std::process::id(),
            current_unix_ms()
        ));
        fs::create_dir_all(&directory).expect("test directory should be created");
        directory
    }

    fn read_json(path: &Path) -> serde_json::Value {
        serde_json::from_str(&fs::read_to_string(path).expect("test JSON file should be readable"))
            .expect("test JSON file should parse")
    }

    #[test]
    fn missing_collection_file_loads_empty_records() {
        let directory = temp_test_dir("missing-collection");
        let path = directory.join("characters.json");

        let records = read_collection_records_from_path(&path, CHARACTERS_ENTITY)
            .expect("missing collection files should load as empty");
        let new_records = vec![serde_json::json!({ "id": "new" })];
        let expected_records = serde_json::Value::Array(new_records.clone());

        assert!(records.is_empty());
        write_runtime_records_to_path(&path, CHARACTERS_ENTITY, new_records)
            .expect("missing collection without recovery artifacts should be replaceable");
        assert_eq!(read_json(&path), expected_records);
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn missing_collection_file_with_recovery_artifacts_blocks_writes() {
        let directory = temp_test_dir("missing-collection-recovery");
        let path = directory.join("characters.json");
        fs::write(backup_json_path(&path), r#"[{"id":"backup"}]"#)
            .expect("backup fixture should be written");
        fs::write(temporary_json_path(&path), r#"[{"id":"temp"}]"#)
            .expect("temp fixture should be written");

        let error = write_runtime_records_to_path(&path, CHARACTERS_ENTITY, Vec::new())
            .expect_err("missing collection with recovery artifacts should block writes");

        assert!(error.contains("Collection file is missing but recovery artifacts exist."));
        assert!(error.contains("backup exists: yes"));
        assert!(error.contains("temp exists: yes"));
        assert!(error.contains("writes blocked: yes"));
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn empty_collection_file_is_recoverable_load_error() {
        let directory = temp_test_dir("empty-collection");
        let path = directory.join("characters.json");
        fs::write(&path, "").expect("empty collection fixture should be written");

        assert!(matches!(
            classify_collection_file(&path),
            CollectionFileState::EmptyClean
        ));
        let error = read_collection_records_from_path(&path, CHARACTERS_ENTITY)
            .expect_err("empty collection file should be rejected by default");
        assert!(error.contains("characters"));
        assert!(error.contains("writes blocked: yes"));

        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn empty_collection_file_blocks_normal_writes() {
        let directory = temp_test_dir("empty-collection-overwrite");
        let path = directory.join("characters.json");
        fs::write(&path, "").expect("empty collection fixture should be written");

        assert!(matches!(
            classify_collection_file(&path),
            CollectionFileState::EmptyClean
        ));
        let read_error = read_collection_records_from_path(&path, CHARACTERS_ENTITY)
            .expect_err("clean empty collection should still be rejected by read path");
        let write_error = write_runtime_records_to_path(&path, CHARACTERS_ENTITY, Vec::new())
            .expect_err("clean empty collection should be rejected by normal write path");
        assert!(read_error.contains("Collection file is empty."));
        assert!(write_error.contains("Collection file is empty."));
        assert!(write_error.contains("writes blocked: yes"));
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn empty_collection_file_with_recovery_artifacts_blocks_writes() {
        let directory = temp_test_dir("empty-collection-recovery");
        let path = directory.join("characters.json");
        fs::write(&path, "").expect("empty collection fixture should be written");
        fs::write(backup_json_path(&path), r#"[{"id":"backup"}]"#)
            .expect("backup fixture should be written");
        fs::write(temporary_json_path(&path), r#"[{"id":"temp"}]"#)
            .expect("temp fixture should be written");

        assert!(matches!(
            classify_collection_file(&path),
            CollectionFileState::EmptyWithRecovery
        ));
        let read_error = read_collection_records_from_path(&path, CHARACTERS_ENTITY)
            .expect_err("recovery-stale empty collection should be rejected by read path");
        let error = write_runtime_records_to_path(&path, CHARACTERS_ENTITY, Vec::new())
            .expect_err("empty collection with recovery artifacts should block writes");

        assert!(read_error.contains("Collection file is empty and recovery artifacts exist."));
        assert!(error.contains("Collection file is empty and recovery artifacts exist."));
        assert!(error.contains("backup exists: yes"));
        assert!(error.contains("temp exists: yes"));
        assert!(error.contains("writes blocked: yes"));
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn non_array_collection_file_is_recoverable_error() {
        let directory = temp_test_dir("non-array-collection");
        let path = directory.join("characters.json");
        fs::write(&path, r#"{"id":"not-an-array"}"#)
            .expect("non-array collection fixture should be written");

        let error = read_collection_records_from_path(&path, CHARACTERS_ENTITY)
            .expect_err("non-array collection files should be rejected");

        assert!(error.contains("characters"));
        assert!(error.contains("Collection file must contain a JSON array."));
        assert!(error.contains("writes blocked: yes"));
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn invalid_json_reports_backup_and_blocks_writes() {
        let directory = temp_test_dir("invalid-json-collection");
        let path = directory.join("characters.json");
        fs::write(&path, "{").expect("invalid collection fixture should be written");
        fs::write(backup_json_path(&path), "[]").expect("backup fixture should be written");

        let error = write_runtime_records_to_path(&path, CHARACTERS_ENTITY, Vec::new())
            .expect_err("invalid JSON should block collection replacement");

        assert!(error.contains("characters"));
        assert!(error.contains("backup exists: yes"));
        assert!(error.contains("writes blocked: yes"));
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn collection_json_writer_can_replace_blocked_collection_for_repair() {
        let directory = temp_test_dir("collection-repair-write");
        let path = directory.join("characters.json");
        let fixed_value = serde_json::json!([{ "id": "fixed" }]);
        fs::write(&path, "{").expect("invalid collection fixture should be written");
        ensure_collection_file_can_be_overwritten(&path, CHARACTERS_ENTITY)
            .expect_err("invalid JSON should block normal collection replacement");

        write_collection_json_file(&path, &fixed_value, "collection file")
            .expect("explicit collection repair write should replace blocked collection");

        assert_eq!(read_json(&path), fixed_value);
        assert_eq!(
            fs::read_to_string(backup_json_path(&path)).expect("backup fixture should be readable"),
            "{"
        );
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn collection_json_write_creates_backup_before_installing_replacement() {
        let directory = temp_test_dir("json-backup");
        let path = directory.join("characters.json");
        let old_value = serde_json::json!([{ "id": "old" }]);
        let new_value = serde_json::json!([{ "id": "new" }]);
        write_collection_json_file(&path, &old_value, "collection file")
            .expect("initial JSON write should succeed");

        write_collection_json_file(&path, &new_value, "collection file")
            .expect("replacement JSON write should succeed");

        assert_eq!(read_json(&path), new_value);
        assert_eq!(read_json(&backup_json_path(&path)), old_value);
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn collection_json_write_aborts_before_temp_when_backup_fails() {
        let directory = temp_test_dir("json-backup-failure");
        let path = directory.join("characters.json");
        let backup_path = backup_json_path(&path);
        let old_value = serde_json::json!([{ "id": "old" }]);
        let new_value = serde_json::json!([{ "id": "new" }]);
        fs::write(
            &path,
            serde_json::to_string(&old_value).expect("old JSON should serialize"),
        )
        .expect("old collection fixture should be written");
        fs::create_dir(&backup_path).expect("backup path fixture should be a directory");

        let error = write_collection_json_file(&path, &new_value, "collection file")
            .expect_err("backup failure should abort collection write");

        assert!(error.contains("Could not create DeKoi JSON backup"));
        assert_eq!(read_json(&path), old_value);
        assert!(!temporary_json_path(&path).exists());
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn collection_json_write_restores_backup_after_install_failure() {
        let directory = temp_test_dir("json-install-failure");
        let path = directory.join("characters.json");
        let old_value = serde_json::json!([{ "id": "old" }]);
        let new_value = serde_json::json!([{ "id": "new" }]);
        write_collection_json_file(&path, &old_value, "collection file")
            .expect("initial JSON write should succeed");

        let error = write_json_file_with_installer(
            &path,
            &new_value,
            "collection file",
            true,
            |_temporary_path, target_path, backup_state| {
                assert!(backup_state.created());
                fs::remove_file(target_path)?;
                Err(io::Error::new(
                    io::ErrorKind::Other,
                    "simulated install failure",
                ))
            },
        )
        .expect_err("simulated install failure should be reported");

        assert!(error.contains("Restored recorded backup."));
        assert!(error.contains("backup created: yes"));
        assert_eq!(read_json(&path), old_value);
        assert_eq!(read_json(&backup_json_path(&path)), old_value);
        assert!(!temporary_json_path(&path).exists());
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn collection_json_write_cleans_temp_when_created_backup_disappears() {
        let directory = temp_test_dir("json-install-missing-backup");
        let path = directory.join("characters.json");
        let old_value = serde_json::json!([{ "id": "old" }]);
        let new_value = serde_json::json!([{ "id": "new" }]);
        write_collection_json_file(&path, &old_value, "collection file")
            .expect("initial JSON write should succeed");

        let error = write_json_file_with_installer(
            &path,
            &new_value,
            "collection file",
            true,
            |_temporary_path, target_path, backup_state| {
                let BackupState::Created { path: backup_path } = backup_state else {
                    panic!("collection backup state should be available");
                };
                fs::remove_file(backup_path)?;
                fs::remove_file(target_path)?;
                Err(io::Error::new(
                    io::ErrorKind::Other,
                    "simulated missing backup failure",
                ))
            },
        )
        .expect_err("simulated missing backup failure should be reported");

        assert!(error.contains("backup created: yes"));
        assert!(error.contains("Restore failed:"));
        assert!(!path.exists());
        assert!(!backup_json_path(&path).exists());
        assert!(!temporary_json_path(&path).exists());
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn bundle_json_write_does_not_create_backup() {
        let directory = temp_test_dir("bundle-no-backup");
        let path = directory.join("dekoi-bundle.json");
        let old_value = serde_json::json!({ "items": [{ "id": "old" }] });
        let new_value = serde_json::json!({ "items": [{ "id": "new" }] });
        write_bundle_file(&path, &old_value).expect("initial bundle write should succeed");

        write_bundle_file(&path, &new_value).expect("replacement bundle write should succeed");

        assert_eq!(read_json(&path), new_value);
        assert!(!backup_json_path(&path).exists());
        let _ = fs::remove_dir_all(directory);
    }
}
