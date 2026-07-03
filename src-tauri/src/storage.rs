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
const ROLEPLAY_ENTRIES_ENTITY: &str = "roleplay-entries";
const LOREBOOKS_ENTITY: &str = "lorebooks";
const LORE_RUNTIME_STATES_ENTITY: &str = "lore-runtime-states";
const MESSENGER_THREADS_ENTITY: &str = "messenger-threads";
const MESSENGER_MESSAGES_ENTITY: &str = "messenger-messages";
const PERSONAS_ENTITY: &str = "personas";
const PROVIDER_CONNECTIONS_ENTITY: &str = "provider-connections";
const RIPPLE_STATES_ENTITY: &str = "ripple-states";
const LEGACY_BUBBLE_THREADS_ENTITY: &str = "bubble-threads";
const COLLECTION_ENTITIES: &[&str] = &[
    APP_SETTINGS_ENTITY,
    CHARACTERS_ENTITY,
    ROLEPLAY_THREADS_ENTITY,
    ROLEPLAY_ENTRIES_ENTITY,
    LOREBOOKS_ENTITY,
    LORE_RUNTIME_STATES_ENTITY,
    MESSENGER_THREADS_ENTITY,
    MESSENGER_MESSAGES_ENTITY,
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

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct StorageCollectionMetadata {
    pub(crate) entity: String,
    pub(crate) exists: bool,
    pub(crate) byte_length: Option<u64>,
    pub(crate) updated_at_ms: Option<u64>,
    pub(crate) content_hash: Option<String>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct StorageCollectionMetadataResult {
    pub(crate) entity: String,
    pub(crate) metadata: Option<StorageCollectionMetadata>,
    pub(crate) error: Option<String>,
    pub(crate) backup_exists: bool,
    pub(crate) backup_restorable: bool,
    pub(crate) temporary_exists: bool,
    pub(crate) pre_repair_exists: bool,
    pub(crate) repairable: bool,
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct StorageCollectionRepairResult {
    pub(crate) ok: bool,
    pub(crate) entity: String,
    pub(crate) strategy: String,
    pub(crate) metadata: StorageCollectionMetadata,
    pub(crate) message: String,
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct StorageCollectionRepairFinishResult {
    pub(crate) ok: bool,
    pub(crate) entity: String,
    pub(crate) metadata: StorageCollectionMetadata,
    pub(crate) pre_repair_removed: bool,
    pub(crate) message: String,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum CollectionRepairStrategy {
    RestoreBackup,
    ReplaceEmpty,
}

impl CollectionRepairStrategy {
    fn parse(strategy: &str) -> Result<Self, String> {
        match strategy.trim() {
            "restore-backup" => Ok(Self::RestoreBackup),
            "replace-empty" => Ok(Self::ReplaceEmpty),
            "" => Err("Storage collection repair requires strategy.".to_string()),
            value => Err(format!(
                "Storage collection repair strategy is not supported: {value}"
            )),
        }
    }

    fn as_str(self) -> &'static str {
        match self {
            Self::RestoreBackup => "restore-backup",
            Self::ReplaceEmpty => "replace-empty",
        }
    }
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

fn runtime_collections_directory(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|dir| dir.join("collections"))
        .map_err(|error| format!("Could not resolve DeKoi app data directory. {error}"))
}

fn collection_path_in_directory(directory: &Path, entity: &str) -> PathBuf {
    directory.join(format!("{entity}.json"))
}

fn collection_entity_from_artifact_name(file_name: &str) -> Option<&str> {
    [".json", ".json.bak", ".json.tmp", ".json.pre-repair"]
        .iter()
        .find_map(|suffix| file_name.strip_suffix(suffix))
        .filter(|entity| !entity.is_empty())
}

fn discovered_collection_entities(directory: &Path) -> Result<Vec<String>, String> {
    let entries = match fs::read_dir(directory) {
        Ok(entries) => entries,
        Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(error) => {
            return Err(format!(
                "Could not inspect DeKoi storage collections directory. {error}"
            ))
        }
    };

    let mut entities = HashSet::new();
    for entry in entries {
        let entry = entry.map_err(|error| {
            format!("Could not inspect DeKoi storage collections directory. {error}")
        })?;
        if !entry
            .file_type()
            .map_err(|error| {
                format!("Could not inspect DeKoi storage collections directory. {error}")
            })?
            .is_file()
        {
            continue;
        }

        let file_name = entry.file_name();
        let file_name = file_name.to_string_lossy();
        if let Some(entity) = collection_entity_from_artifact_name(&file_name) {
            entities.insert(entity.to_string());
        }
    }

    let mut discovered = entities.into_iter().collect::<Vec<_>>();
    discovered.sort();
    Ok(discovered)
}

fn collection_metadata_results_for_app(
    app: &tauri::AppHandle,
) -> Result<Vec<StorageCollectionMetadataResult>, String> {
    let directory = runtime_collections_directory(app)?;
    let mut entities = COLLECTION_ENTITIES
        .iter()
        .map(|entity| entity.to_string())
        .collect::<Vec<_>>();
    let mut seen = entities.iter().cloned().collect::<HashSet<_>>();

    for entity in discovered_collection_entities(&directory)? {
        if seen.insert(entity.clone()) {
            entities.push(entity);
        }
    }

    Ok(entities
        .into_iter()
        .map(|entity| {
            let path = collection_path_in_directory(&directory, &entity);
            collection_metadata_result_from_path(&entity, path)
        })
        .collect())
}

fn modified_at_ms(metadata: &fs::Metadata) -> Option<u64> {
    metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis() as u64)
}

fn fnv1a64_hex(bytes: &[u8]) -> String {
    let mut hash = 0xcbf29ce484222325_u64;
    for byte in bytes {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    format!("fnv1a64:{hash:016x}")
}

fn collection_content_hash(path: &Path) -> Option<String> {
    fs::read(path).ok().map(|bytes| fnv1a64_hex(&bytes))
}

fn collection_metadata_from_path(
    entity: &str,
    path: PathBuf,
) -> Result<StorageCollectionMetadata, String> {
    match fs::metadata(&path) {
        Ok(metadata) => Ok(StorageCollectionMetadata {
            entity: entity.to_string(),
            exists: true,
            byte_length: Some(metadata.len()),
            updated_at_ms: modified_at_ms(&metadata),
            content_hash: collection_content_hash(&path),
        }),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(StorageCollectionMetadata {
            entity: entity.to_string(),
            exists: false,
            byte_length: None,
            updated_at_ms: None,
            content_hash: None,
        }),
        Err(error) => Err(format!(
            "Could not inspect DeKoi storage collection '{entity}'. {error}"
        )),
    }
}

fn collection_metadata_result_from_path(
    entity: &str,
    path: PathBuf,
) -> StorageCollectionMetadataResult {
    let state = classify_collection_file(&path);
    let error = collection_file_state_error_reason(&state)
        .map(|reason| collection_file_error(entity, &path, reason));
    let repairable = collection_file_state_is_repairable(&state);
    let metadata_result = collection_metadata_from_path(entity, path.clone());
    let metadata_error = metadata_result.as_ref().err().cloned();

    StorageCollectionMetadataResult {
        entity: entity.to_string(),
        metadata: metadata_result.ok(),
        error: error.or(metadata_error),
        backup_exists: backup_exists(&path),
        backup_restorable: read_collection_backup_for_restore(&backup_json_path(&path), entity)
            .is_ok(),
        temporary_exists: temporary_json_exists(&path),
        pre_repair_exists: pre_repair_exists(&path),
        repairable,
    }
}

fn storage_collection_metadata_result(
    app: &tauri::AppHandle,
    entity: &str,
) -> Result<StorageCollectionMetadataResult, String> {
    ensure_collection_entity(entity)?;
    let path = runtime_entity_path(app, entity)?;
    Ok(collection_metadata_result_from_path(entity, path))
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

fn pre_repair_json_path(path: &Path) -> PathBuf {
    path.with_extension("json.pre-repair")
}

fn backup_exists(path: &Path) -> bool {
    backup_json_path(path).exists()
}

fn pre_repair_exists(path: &Path) -> bool {
    pre_repair_json_path(path).exists()
}

fn temporary_json_exists(path: &Path) -> bool {
    temporary_json_path(path).exists()
}

fn recovery_artifacts_exist(path: &Path) -> bool {
    backup_exists(path) || temporary_json_exists(path) || pre_repair_exists(path)
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
    RollbackCreated { path: PathBuf },
}

impl BackupState {
    fn created(&self) -> bool {
        matches!(self, BackupState::Created { .. })
    }

    fn recorded_path(&self) -> Option<&Path> {
        match self {
            BackupState::Created { path } | BackupState::RollbackCreated { path } => {
                Some(path.as_path())
            }
            BackupState::NotRequested | BackupState::NoSourceFile => None,
        }
    }

    fn cleanup_transient_rollback(&self) -> Result<(), String> {
        if let BackupState::RollbackCreated { path } = self {
            match fs::remove_file(path) {
                Ok(()) => Ok(()),
                Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(()),
                Err(error) => Err(format!(
                    "Could not remove DeKoi JSON rollback file. {error}"
                )),
            }
        } else {
            Ok(())
        }
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

fn repair_rollback_json_path(path: &Path) -> PathBuf {
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("collection.json");
    let stamp = Utc::now().timestamp_millis();
    let rollback_name = format!("{file_name}.rollback-{}-{stamp}.tmp", std::process::id());
    path.with_file_name(rollback_name)
}

fn preserve_current_for_repair_rollback(path: &Path) -> Result<BackupState, String> {
    if !path.exists() {
        return Ok(BackupState::NoSourceFile);
    }

    let rollback_path = repair_rollback_json_path(path);
    fs::copy(path, &rollback_path).map_err(|error| {
        format!("Could not preserve DeKoi collection for repair rollback. {error}")
    })?;
    sync_file_best_effort(&rollback_path);
    sync_parent_directory_best_effort(&rollback_path);

    Ok(BackupState::RollbackCreated {
        path: rollback_path,
    })
}

fn install_temporary_json_file(
    temporary_path: &Path,
    path: &Path,
    backup_state: &BackupState,
) -> io::Result<()> {
    match fs::rename(temporary_path, path) {
        Ok(()) => Ok(()),
        Err(first_error) => match backup_state {
            BackupState::NotRequested => Err(first_error),
            BackupState::NoSourceFile => Err(io::Error::new(
                first_error.kind(),
                format!("no recorded backup existed before replacement: {first_error}"),
            )),
            BackupState::Created { .. } | BackupState::RollbackCreated { .. } => {
                if let Err(remove_error) = fs::remove_file(path) {
                    return if remove_error.kind() == io::ErrorKind::NotFound {
                        Err(first_error)
                    } else {
                        Err(remove_error)
                    };
                }
                fs::rename(temporary_path, path)
            }
        },
    }
}

fn restore_backup_from_path(backup_path: &Path, path: &Path) -> Result<(), String> {
    fs::copy(backup_path, path)
        .map_err(|error| format!("Could not restore DeKoi JSON backup. {error}"))?;
    sync_file_best_effort(path);
    sync_parent_directory_best_effort(path);
    Ok(())
}

fn restore_recorded_backup(path: &Path, backup_state: &BackupState) -> String {
    let Some(backup_path) = backup_state.recorded_path() else {
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

fn ensure_json_parent_directory(path: &Path) -> Result<(), String> {
    if let Some(directory) = path.parent() {
        fs::create_dir_all(directory)
            .map_err(|error| format!("Could not create DeKoi runtime directory. {error}"))?;
    }

    Ok(())
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
    ensure_json_parent_directory(path)?;
    let backup_state = preserve_existing_backup(path, path_category, preserve_backup)?;

    write_json_file_with_backup_state(path, value, path_category, backup_state, installer)
}

fn write_json_file_with_backup_state<F>(
    path: &Path,
    value: &serde_json::Value,
    path_category: &str,
    backup_state: BackupState,
    installer: F,
) -> Result<(), String>
where
    F: FnOnce(&Path, &Path, &BackupState) -> io::Result<()>,
{
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
        let restore_message = restore_recorded_backup(path, &backup_state);
        let rollback_cleanup_message = backup_state
            .cleanup_transient_rollback()
            .err()
            .map(|cleanup_error| format!(" {cleanup_error}"))
            .unwrap_or_default();
        return Err(format!(
            "Could not save DeKoi JSON data (path category: {path_category}; backup created: {}). {error}.{cleanup_message}{restore_message}{rollback_cleanup_message}",
            yes_no(backup_state.created()),
        ));
    }

    sync_file_best_effort(path);
    sync_parent_directory_best_effort(path);
    cleanup_result?;
    backup_state.cleanup_transient_rollback()?;

    Ok(())
}

fn collection_file_error(entity: &str, path: &Path, reason: String) -> String {
    format!(
        "Desktop runtime storage collection '{entity}' could not be loaded (path category: collection file; backup exists: {}; temp exists: {}; pre-repair exists: {}; writes blocked: yes). {reason}",
        yes_no(backup_exists(path)),
        yes_no(temporary_json_exists(path)),
        yes_no(pre_repair_exists(path)),
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

fn collection_file_state_is_repairable(state: &CollectionFileState) -> bool {
    matches!(
        state,
        CollectionFileState::InvalidJson(_)
            | CollectionFileState::NonArray
            | CollectionFileState::EmptyClean
            | CollectionFileState::EmptyWithRecovery
            | CollectionFileState::MissingWithRecovery
    )
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

fn ensure_collection_file_needs_repair(path: &Path, entity: &str) -> Result<(), String> {
    let state = classify_collection_file(path);
    if collection_file_state_is_repairable(&state) {
        return Ok(());
    }

    match state {
        CollectionFileState::MissingClean => Err(format!(
            "Storage collection repair is not allowed for '{entity}' because the collection file is missing without recovery artifacts."
        )),
        CollectionFileState::Records(_) => Err(format!(
            "Storage collection repair is not allowed for '{entity}' because the collection file is already valid."
        )),
        CollectionFileState::ReadFailure(error) => Err(format!(
            "Storage collection repair is not allowed for '{entity}' because the collection file could not be read. {error}"
        )),
        CollectionFileState::InvalidJson(_)
        | CollectionFileState::NonArray
        | CollectionFileState::EmptyClean
        | CollectionFileState::EmptyWithRecovery
        | CollectionFileState::MissingWithRecovery => {
            unreachable!("repairable collection states are handled before this match")
        }
    }
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

fn replace_runtime_records_at_path(
    path: &Path,
    entity: &str,
    records: Vec<serde_json::Value>,
) -> Result<StorageCollectionMetadata, String> {
    write_runtime_records_to_path(path, entity, records)?;
    collection_metadata_from_path(entity, path.to_path_buf())
}

fn read_collection_backup_for_restore(
    backup_path: &Path,
    entity: &str,
) -> Result<Vec<serde_json::Value>, String> {
    if !backup_path.exists() {
        return Err(format!(
            "No DeKoi JSON backup exists for storage collection '{entity}'."
        ));
    }

    let contents = fs::read_to_string(backup_path).map_err(|error| {
        format!("Could not read DeKoi JSON backup for storage collection '{entity}'. {error}")
    })?;
    if contents.trim().is_empty() {
        return Err(format!(
            "DeKoi JSON backup for storage collection '{entity}' is empty."
        ));
    }

    match serde_json::from_str::<serde_json::Value>(&contents) {
        Ok(serde_json::Value::Array(records)) => Ok(records),
        Ok(_) => Err(format!(
            "DeKoi JSON backup for storage collection '{entity}' must contain a JSON array."
        )),
        Err(error) => Err(format!(
            "DeKoi JSON backup for storage collection '{entity}' is not valid JSON. {error}"
        )),
    }
}

fn preserve_pre_repair_collection(path: &Path) -> Result<BackupState, String> {
    let pre_repair_path = pre_repair_json_path(path);
    if pre_repair_path.exists() {
        return preserve_current_for_repair_rollback(path);
    }

    if !path.exists() {
        return Ok(BackupState::NoSourceFile);
    }

    fs::copy(path, &pre_repair_path).map_err(|error| {
        format!("Could not preserve DeKoi collection before repair restore. {error}")
    })?;
    sync_file_best_effort(&pre_repair_path);
    sync_parent_directory_best_effort(&pre_repair_path);

    Ok(BackupState::Created {
        path: pre_repair_path,
    })
}

fn ensure_replace_empty_is_allowed(path: &Path, entity: &str) -> Result<(), String> {
    let backup_path = backup_json_path(path);
    if backup_path.exists() && read_collection_backup_for_restore(&backup_path, entity).is_ok() {
        return Err(format!(
            "Storage collection repair cannot replace '{entity}' with an empty collection while a valid backup is available. Use restore-backup first."
        ));
    }

    Ok(())
}

fn write_empty_collection_for_repair(path: &Path, entity: &str) -> Result<(), String> {
    ensure_replace_empty_is_allowed(path, entity)?;
    ensure_json_parent_directory(path)?;
    let backup_state = preserve_pre_repair_collection(path)?;
    write_json_file_with_backup_state(
        path,
        &serde_json::Value::Array(Vec::new()),
        "collection repair replacement",
        backup_state,
        install_temporary_json_file,
    )
}

fn write_backup_collection_for_repair(
    path: &Path,
    records: Vec<serde_json::Value>,
) -> Result<(), String> {
    ensure_json_parent_directory(path)?;
    let backup_state = preserve_pre_repair_collection(path)?;
    write_json_file_with_backup_state(
        path,
        &serde_json::Value::Array(records),
        "collection repair restore",
        backup_state,
        install_temporary_json_file,
    )
}

fn repair_collection_at_path(
    path: &Path,
    entity: &str,
    strategy: CollectionRepairStrategy,
    confirm: bool,
) -> Result<StorageCollectionRepairResult, String> {
    ensure_collection_entity(entity)?;
    if !confirm {
        return Err("Storage collection repair requires confirm: true.".to_string());
    }
    ensure_collection_file_needs_repair(path, entity)?;

    let message = match strategy {
        CollectionRepairStrategy::RestoreBackup => {
            let backup_path = backup_json_path(path);
            let records = read_collection_backup_for_restore(&backup_path, entity)?;
            write_backup_collection_for_repair(path, records)?;
            format!("Restored {entity} from the desktop backup.")
        }
        CollectionRepairStrategy::ReplaceEmpty => {
            write_empty_collection_for_repair(path, entity)?;
            format!("Replaced {entity} with an empty valid collection.")
        }
    };
    let metadata = collection_metadata_from_path(entity, path.to_path_buf())?;

    Ok(StorageCollectionRepairResult {
        ok: true,
        entity: entity.to_string(),
        strategy: strategy.as_str().to_string(),
        metadata,
        message,
    })
}

pub(crate) fn repair_runtime_collection(
    app: &tauri::AppHandle,
    entity: &str,
    strategy: &str,
    confirm: bool,
) -> Result<StorageCollectionRepairResult, String> {
    ensure_collection_entity(entity)?;
    let strategy = CollectionRepairStrategy::parse(strategy)?;
    if !confirm {
        return Err("Storage collection repair requires confirm: true.".to_string());
    }

    let path = runtime_entity_path(app, entity)?;
    repair_collection_at_path(&path, entity, strategy, true)
}

fn finish_collection_repair_at_path(
    path: &Path,
    entity: &str,
    confirm: bool,
) -> Result<StorageCollectionRepairFinishResult, String> {
    ensure_collection_entity(entity)?;
    if !confirm {
        return Err("Finishing storage collection repair requires confirm: true.".to_string());
    }
    ensure_collection_file_is_usable(path, entity)?;

    let pre_repair_path = pre_repair_json_path(path);
    if !pre_repair_path.exists() {
        return Err(format!(
            "No pre-repair sidecar exists for storage collection '{entity}'."
        ));
    }

    fs::remove_file(&pre_repair_path).map_err(|error| {
        format!("Could not remove pre-repair sidecar for storage collection '{entity}'. {error}")
    })?;
    sync_parent_directory_best_effort(&pre_repair_path);

    let metadata = collection_metadata_from_path(entity, path.to_path_buf())?;
    Ok(StorageCollectionRepairFinishResult {
        ok: true,
        entity: entity.to_string(),
        metadata,
        pre_repair_removed: true,
        message: format!("Finished storage repair for {entity}."),
    })
}

pub(crate) fn finish_runtime_collection_repair(
    app: &tauri::AppHandle,
    entity: &str,
    confirm: bool,
) -> Result<StorageCollectionRepairFinishResult, String> {
    ensure_collection_entity(entity)?;
    if !confirm {
        return Err("Finishing storage collection repair requires confirm: true.".to_string());
    }

    let path = runtime_entity_path(app, entity)?;
    finish_collection_repair_at_path(&path, entity, true)
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
    let path = runtime_entity_path(app, entity)?;
    let metadata = replace_runtime_records_at_path(&path, entity, normalized_records)?;

    Ok(serde_json::json!({ "ok": true, "count": count, "metadata": metadata }))
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

#[tauri::command]
pub(crate) fn dekoi_storage_repair_collection(
    app: tauri::AppHandle,
    entity: String,
    strategy: String,
    confirm: bool,
) -> Result<StorageCollectionRepairResult, String> {
    repair_runtime_collection(&app, entity.trim(), strategy.trim(), confirm)
}

#[tauri::command]
pub(crate) fn dekoi_storage_finish_collection_repair(
    app: tauri::AppHandle,
    entity: String,
    confirm: bool,
) -> Result<StorageCollectionRepairFinishResult, String> {
    finish_runtime_collection_repair(&app, entity.trim(), confirm)
}

#[tauri::command]
pub(crate) fn dekoi_storage_collection_metadata(
    app: tauri::AppHandle,
    entity: Option<String>,
) -> Result<Vec<StorageCollectionMetadataResult>, String> {
    let requested_entity = entity
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());

    if let Some(entity) = requested_entity {
        return Ok(vec![storage_collection_metadata_result(&app, entity)?]);
    }

    collection_metadata_results_for_app(&app)
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

    fn rollback_file_count(directory: &Path) -> usize {
        fs::read_dir(directory)
            .expect("test directory should be readable")
            .filter_map(Result::ok)
            .filter(|entry| entry.file_name().to_string_lossy().contains(".rollback-"))
            .count()
    }

    #[test]
    fn collection_metadata_reports_missing_and_changed_files() {
        let directory = temp_test_dir("collection-metadata");
        let path = directory.join("characters.json");

        let missing_metadata = collection_metadata_from_path(CHARACTERS_ENTITY, path.clone())
            .expect("missing collection metadata should be readable");
        assert_eq!(missing_metadata.entity, CHARACTERS_ENTITY);
        assert!(!missing_metadata.exists);
        assert_eq!(missing_metadata.byte_length, None);
        assert_eq!(missing_metadata.content_hash, None);

        fs::write(&path, r#"[{"id":"first"}]"#).expect("first fixture should be written");
        let first_metadata = collection_metadata_from_path(CHARACTERS_ENTITY, path.clone())
            .expect("first collection metadata should be readable");
        assert!(first_metadata.exists);
        assert_eq!(first_metadata.byte_length, Some(16));
        assert!(first_metadata.updated_at_ms.is_some());
        assert!(first_metadata.content_hash.is_some());

        fs::write(&path, r#"[{"id":"other"}]"#).expect("second fixture should be written");
        let second_metadata = collection_metadata_from_path(CHARACTERS_ENTITY, path)
            .expect("second collection metadata should be readable");
        assert_ne!(first_metadata.content_hash, second_metadata.content_hash);
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn collection_metadata_result_preserves_entity_errors() {
        let directory = temp_test_dir("collection-metadata-result-error");
        let good_path = directory.join("characters.json");
        fs::write(&good_path, r#"[{"id":"first"}]"#).expect("good fixture should be written");

        let good_result = collection_metadata_result_from_path(CHARACTERS_ENTITY, good_path);
        assert_eq!(good_result.entity, CHARACTERS_ENTITY);
        assert!(good_result.metadata.is_some());
        assert_eq!(good_result.error, None);
        assert!(!good_result.backup_exists);
        assert!(!good_result.pre_repair_exists);
        assert!(!good_result.repairable);

        let invalid_path = PathBuf::from(format!("{}\0personas.json", directory.to_string_lossy()));
        let error_result = collection_metadata_result_from_path(PERSONAS_ENTITY, invalid_path);
        assert_eq!(error_result.entity, PERSONAS_ENTITY);
        assert!(error_result.metadata.is_none());
        assert!(error_result
            .error
            .expect("entity error should be reported")
            .contains("Could not inspect DeKoi storage collection"));
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn collection_metadata_result_reports_repairable_malformed_collection() {
        let directory = temp_test_dir("collection-metadata-repairable");
        let path = directory.join("characters.json");
        fs::write(&path, "{").expect("invalid collection fixture should be written");
        fs::write(backup_json_path(&path), "[]").expect("backup fixture should be written");

        let result = collection_metadata_result_from_path(CHARACTERS_ENTITY, path);

        assert_eq!(result.entity, CHARACTERS_ENTITY);
        assert!(result.metadata.is_some());
        assert!(result
            .error
            .expect("invalid JSON should be reported")
            .contains("Collection file is not valid JSON"));
        assert!(result.backup_exists);
        assert!(result.backup_restorable);
        assert!(!result.temporary_exists);
        assert!(!result.pre_repair_exists);
        assert!(result.repairable);
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn collection_metadata_result_reports_invalid_backup_not_restorable() {
        let directory = temp_test_dir("collection-metadata-invalid-backup");
        let path = directory.join("characters.json");
        fs::write(&path, "{").expect("invalid collection fixture should be written");
        fs::write(backup_json_path(&path), "{").expect("invalid backup fixture should be written");

        let result = collection_metadata_result_from_path(CHARACTERS_ENTITY, path);

        assert_eq!(result.entity, CHARACTERS_ENTITY);
        assert!(result.backup_exists);
        assert!(!result.backup_restorable);
        assert!(result.repairable);
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn discovered_collection_entities_include_unknown_files_and_sidecars() {
        let directory = temp_test_dir("collection-metadata-discovery");
        fs::write(directory.join("future-entity.json"), "{")
            .expect("unknown collection fixture should be written");
        fs::write(directory.join("archived-entity.json.pre-repair"), "{")
            .expect("unknown pre-repair fixture should be written");
        fs::write(directory.join("temporary-entity.json.tmp"), "[]")
            .expect("unknown temp fixture should be written");
        fs::write(directory.join("backup-entity.json.bak"), "[]")
            .expect("unknown backup fixture should be written");
        fs::write(directory.join("not-a-collection.txt"), "[]")
            .expect("non-collection fixture should be written");

        let entities =
            discovered_collection_entities(&directory).expect("discovery should succeed");

        assert_eq!(
            entities,
            vec![
                "archived-entity".to_string(),
                "backup-entity".to_string(),
                "future-entity".to_string(),
                "temporary-entity".to_string(),
            ]
        );
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn replace_runtime_records_returns_persisted_metadata() {
        let directory = temp_test_dir("replace-metadata");
        let path = directory.join("characters.json");
        let records = vec![serde_json::json!({ "id": "first" })];

        let metadata = replace_runtime_records_at_path(&path, CHARACTERS_ENTITY, records)
            .expect("replace should succeed");
        let persisted_metadata = collection_metadata_from_path(CHARACTERS_ENTITY, path.clone())
            .expect("persisted metadata should be readable");

        assert_eq!(read_json(&path), serde_json::json!([{ "id": "first" }]));
        assert_eq!(metadata.entity, CHARACTERS_ENTITY);
        assert!(metadata.exists);
        assert_eq!(metadata.byte_length, persisted_metadata.byte_length);
        assert_eq!(metadata.content_hash, persisted_metadata.content_hash);
        let _ = fs::remove_dir_all(directory);
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
    fn missing_collection_file_with_pre_repair_artifact_blocks_writes() {
        let directory = temp_test_dir("missing-collection-pre-repair");
        let path = directory.join("characters.json");
        fs::write(pre_repair_json_path(&path), "{").expect("pre-repair fixture should be written");

        let error = write_runtime_records_to_path(&path, CHARACTERS_ENTITY, Vec::new())
            .expect_err("missing collection with pre-repair artifact should block writes");

        assert!(error.contains("Collection file is missing but recovery artifacts exist."));
        assert!(error.contains("pre-repair exists: yes"));
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
    fn repair_collection_restores_malformed_collection_from_backup() {
        let directory = temp_test_dir("collection-restore-backup");
        let path = directory.join("characters.json");
        let backup_value = serde_json::json!([{ "id": "backup" }]);
        let backup_contents =
            serde_json::to_string(&backup_value).expect("backup JSON should serialize");
        fs::write(&path, "{").expect("invalid collection fixture should be written");
        fs::write(backup_json_path(&path), &backup_contents)
            .expect("backup fixture should be written");

        let result = repair_collection_at_path(
            &path,
            CHARACTERS_ENTITY,
            CollectionRepairStrategy::RestoreBackup,
            true,
        )
        .expect("restore repair should succeed");
        let persisted_metadata = collection_metadata_from_path(CHARACTERS_ENTITY, path.clone())
            .expect("persisted metadata should be readable");

        assert!(result.ok);
        assert_eq!(result.entity, CHARACTERS_ENTITY);
        assert_eq!(result.strategy, "restore-backup");
        assert!(result.message.contains("Restored characters"));
        assert_eq!(read_json(&path), backup_value);
        assert_eq!(read_json(&backup_json_path(&path)), backup_value);
        assert_eq!(
            fs::read_to_string(pre_repair_json_path(&path))
                .expect("pre-repair fixture should be readable"),
            "{"
        );
        assert_ne!(
            fs::read_to_string(&path).expect("restored collection should be readable"),
            backup_contents
        );
        assert_eq!(result.metadata.entity, CHARACTERS_ENTITY);
        assert_eq!(result.metadata.byte_length, persisted_metadata.byte_length);
        assert_eq!(
            result.metadata.content_hash,
            persisted_metadata.content_hash
        );
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn repair_collection_restore_keeps_existing_pre_repair_file() {
        let directory = temp_test_dir("collection-restore-existing-pre-repair");
        let path = directory.join("characters.json");
        let backup_value = serde_json::json!([{ "id": "backup" }]);
        fs::write(&path, "{").expect("invalid collection fixture should be written");
        fs::write(pre_repair_json_path(&path), "previous pre-repair")
            .expect("pre-repair fixture should be written");
        fs::write(
            backup_json_path(&path),
            serde_json::to_string(&backup_value).expect("backup JSON should serialize"),
        )
        .expect("backup fixture should be written");

        let result = repair_collection_at_path(
            &path,
            CHARACTERS_ENTITY,
            CollectionRepairStrategy::RestoreBackup,
            true,
        )
        .expect("restore repair should succeed");

        assert!(result.ok);
        assert_eq!(read_json(&path), backup_value);
        assert_eq!(
            fs::read_to_string(pre_repair_json_path(&path))
                .expect("pre-repair fixture should be readable"),
            "previous pre-repair"
        );
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn finish_collection_repair_removes_pre_repair_after_valid_restore() {
        let directory = temp_test_dir("collection-repair-finish");
        let path = directory.join("characters.json");
        let restored_value = serde_json::json!([{ "id": "restored" }]);
        fs::write(
            &path,
            serde_json::to_string(&restored_value).expect("collection JSON should serialize"),
        )
        .expect("valid collection fixture should be written");
        fs::write(pre_repair_json_path(&path), "{").expect("pre-repair fixture should be written");

        let result = finish_collection_repair_at_path(&path, CHARACTERS_ENTITY, true)
            .expect("finish repair should succeed");

        assert!(result.ok);
        assert_eq!(result.entity, CHARACTERS_ENTITY);
        assert!(result.pre_repair_removed);
        assert!(!pre_repair_json_path(&path).exists());
        assert_eq!(read_json(&path), restored_value);
        assert_eq!(result.metadata.entity, CHARACTERS_ENTITY);
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn finish_collection_repair_rejects_invalid_live_collection() {
        let directory = temp_test_dir("collection-repair-finish-invalid");
        let path = directory.join("characters.json");
        fs::write(&path, "{").expect("invalid collection fixture should be written");
        fs::write(pre_repair_json_path(&path), "previous pre-repair")
            .expect("pre-repair fixture should be written");

        let error = finish_collection_repair_at_path(&path, CHARACTERS_ENTITY, true)
            .expect_err("finish repair should reject invalid live collection");

        assert!(error.contains("Collection file is not valid JSON"));
        assert_eq!(
            fs::read_to_string(pre_repair_json_path(&path))
                .expect("pre-repair fixture should remain readable"),
            "previous pre-repair"
        );
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn repair_collection_restore_rolls_back_current_file_after_install_failure() {
        let directory = temp_test_dir("collection-restore-install-failure");
        let path = directory.join("characters.json");
        let backup_value = serde_json::json!([{ "id": "backup" }]);
        fs::write(&path, "{").expect("invalid collection fixture should be written");
        fs::write(pre_repair_json_path(&path), "previous pre-repair")
            .expect("pre-repair fixture should be written");
        fs::write(
            backup_json_path(&path),
            serde_json::to_string(&backup_value).expect("backup JSON should serialize"),
        )
        .expect("backup fixture should be written");
        let backup_state =
            preserve_pre_repair_collection(&path).expect("rollback state should be created");

        let error = write_json_file_with_backup_state(
            &path,
            &backup_value,
            "collection repair restore",
            backup_state,
            |_temporary_path, target_path, _backup_state| {
                fs::remove_file(target_path)?;
                Err(io::Error::other("simulated install failure"))
            },
        )
        .expect_err("simulated repair install failure should be reported");

        assert!(error.contains("Restored recorded backup."));
        assert_eq!(
            fs::read_to_string(&path).expect("current fixture should be readable"),
            "{"
        );
        assert_eq!(read_json(&backup_json_path(&path)), backup_value);
        assert_eq!(
            fs::read_to_string(pre_repair_json_path(&path))
                .expect("pre-repair fixture should be readable"),
            "previous pre-repair"
        );
        assert_eq!(rollback_file_count(&directory), 0);
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn repair_collection_replaces_malformed_collection_with_empty_array() {
        let directory = temp_test_dir("collection-replace-empty");
        let path = directory.join("characters.json");
        fs::write(&path, "{").expect("invalid collection fixture should be written");

        let result = repair_collection_at_path(
            &path,
            CHARACTERS_ENTITY,
            CollectionRepairStrategy::ReplaceEmpty,
            true,
        )
        .expect("replace-empty repair should succeed");

        assert!(result.ok);
        assert_eq!(result.strategy, "replace-empty");
        assert!(result.message.contains("empty valid collection"));
        assert_eq!(read_json(&path), serde_json::json!([]));
        assert_eq!(
            fs::read_to_string(pre_repair_json_path(&path))
                .expect("pre-repair fixture should be readable"),
            "{"
        );
        assert!(result.metadata.exists);
        assert_eq!(
            read_collection_records_from_path(&path, CHARACTERS_ENTITY)
                .expect("repaired collection should load"),
            Vec::<serde_json::Value>::new()
        );
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn repair_collection_replace_empty_rolls_back_current_file_after_install_failure() {
        let directory = temp_test_dir("collection-replace-empty-install-failure");
        let path = directory.join("characters.json");
        fs::write(&path, "{").expect("invalid collection fixture should be written");
        let backup_state =
            preserve_pre_repair_collection(&path).expect("rollback state should be created");

        let error = write_json_file_with_backup_state(
            &path,
            &serde_json::Value::Array(Vec::new()),
            "collection repair replacement",
            backup_state,
            |_temporary_path, target_path, _backup_state| {
                fs::remove_file(target_path)?;
                Err(io::Error::other("simulated install failure"))
            },
        )
        .expect_err("simulated repair install failure should be reported");

        assert!(error.contains("Restored recorded backup."));
        assert_eq!(
            fs::read_to_string(&path).expect("current fixture should be readable"),
            "{"
        );
        assert_eq!(
            fs::read_to_string(pre_repair_json_path(&path))
                .expect("pre-repair fixture should be readable"),
            "{"
        );
        assert_eq!(rollback_file_count(&directory), 0);
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn repair_collection_requires_confirmation() {
        let directory = temp_test_dir("collection-repair-confirm");
        let path = directory.join("characters.json");
        fs::write(&path, "{").expect("invalid collection fixture should be written");
        fs::write(backup_json_path(&path), "[]").expect("backup fixture should be written");

        let error = repair_collection_at_path(
            &path,
            CHARACTERS_ENTITY,
            CollectionRepairStrategy::RestoreBackup,
            false,
        )
        .expect_err("repair should require confirmation");

        assert!(error.contains("confirm: true"));
        assert_eq!(
            fs::read_to_string(&path).expect("invalid fixture should remain readable"),
            "{"
        );
        assert_eq!(read_json(&backup_json_path(&path)), serde_json::json!([]));
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn repair_collection_restore_requires_backup() {
        let directory = temp_test_dir("collection-restore-missing-backup");
        let path = directory.join("characters.json");
        fs::write(&path, "{").expect("invalid collection fixture should be written");

        let error = repair_collection_at_path(
            &path,
            CHARACTERS_ENTITY,
            CollectionRepairStrategy::RestoreBackup,
            true,
        )
        .expect_err("restore repair should require a backup file");

        assert!(error.contains("No DeKoi JSON backup exists"));
        assert_eq!(
            fs::read_to_string(&path).expect("invalid fixture should remain readable"),
            "{"
        );
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn repair_collection_replace_empty_rejects_valid_existing_backup() {
        let directory = temp_test_dir("collection-replace-empty-existing-backup");
        let path = directory.join("characters.json");
        let backup_value = serde_json::json!([{ "id": "backup" }]);
        fs::write(&path, "{").expect("invalid collection fixture should be written");
        fs::write(
            backup_json_path(&path),
            serde_json::to_string(&backup_value).expect("backup JSON should serialize"),
        )
        .expect("backup fixture should be written");

        let error = repair_collection_at_path(
            &path,
            CHARACTERS_ENTITY,
            CollectionRepairStrategy::ReplaceEmpty,
            true,
        )
        .expect_err("replace-empty repair should reject a valid backup");

        assert!(error.contains("valid backup is available"));
        assert_eq!(
            fs::read_to_string(&path).expect("invalid fixture should remain readable"),
            "{"
        );
        assert_eq!(read_json(&backup_json_path(&path)), backup_value);
        assert!(!pre_repair_json_path(&path).exists());
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn repair_collection_replace_empty_preserves_invalid_collection_with_invalid_backup() {
        let directory = temp_test_dir("collection-replace-empty-invalid-backup");
        let path = directory.join("characters.json");
        fs::write(&path, "{").expect("invalid collection fixture should be written");
        fs::write(backup_json_path(&path), "{").expect("invalid backup fixture should be written");

        let result = repair_collection_at_path(
            &path,
            CHARACTERS_ENTITY,
            CollectionRepairStrategy::ReplaceEmpty,
            true,
        )
        .expect("replace-empty repair should succeed without a valid backup");

        assert!(result.ok);
        assert_eq!(read_json(&path), serde_json::json!([]));
        assert_eq!(
            fs::read_to_string(pre_repair_json_path(&path))
                .expect("pre-repair fixture should be readable"),
            "{"
        );
        assert_eq!(
            fs::read_to_string(backup_json_path(&path)).expect("backup fixture should be readable"),
            "{"
        );
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn repair_collection_rejects_valid_collection() {
        let directory = temp_test_dir("collection-repair-valid");
        let path = directory.join("characters.json");
        let value = serde_json::json!([{ "id": "healthy" }]);
        fs::write(
            &path,
            serde_json::to_string(&value).expect("collection JSON should serialize"),
        )
        .expect("collection fixture should be written");
        fs::write(backup_json_path(&path), "[]").expect("backup fixture should be written");

        let replace_error = repair_collection_at_path(
            &path,
            CHARACTERS_ENTITY,
            CollectionRepairStrategy::ReplaceEmpty,
            true,
        )
        .expect_err("replace-empty should reject valid collections");
        let restore_error = repair_collection_at_path(
            &path,
            CHARACTERS_ENTITY,
            CollectionRepairStrategy::RestoreBackup,
            true,
        )
        .expect_err("restore-backup should reject valid collections");

        assert!(replace_error.contains("already valid"));
        assert!(restore_error.contains("already valid"));
        assert_eq!(read_json(&path), value);
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn repair_collection_rejects_clean_missing_collection() {
        let directory = temp_test_dir("collection-repair-missing-clean");
        let path = directory.join("characters.json");

        let error = repair_collection_at_path(
            &path,
            CHARACTERS_ENTITY,
            CollectionRepairStrategy::ReplaceEmpty,
            true,
        )
        .expect_err("repair should reject clean missing collections");

        assert!(error.contains("missing without recovery artifacts"));
        assert!(!path.exists());
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
                Err(io::Error::other("simulated install failure"))
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
                Err(io::Error::other("simulated missing backup failure"))
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

    #[test]
    fn bundle_install_failure_without_backup_preserves_target() {
        let directory = temp_test_dir("bundle-install-failure");
        let path = directory.join("dekoi-bundle.json");
        let missing_temporary_path = temporary_json_path(&path);
        let old_contents = r#"{"items":[{"id":"old"}]}"#;
        fs::write(&path, old_contents).expect("old bundle fixture should be written");

        install_temporary_json_file(&missing_temporary_path, &path, &BackupState::NotRequested)
            .expect_err("missing temp install should fail without removing old bundle");

        assert_eq!(
            fs::read_to_string(&path).expect("old bundle should be restored"),
            old_contents
        );
        let _ = fs::remove_dir_all(directory);
    }
}
