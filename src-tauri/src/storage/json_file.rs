use std::{
    ffi::OsString,
    fs::{self, File, OpenOptions},
    io::{self, BufReader, Read, Write},
    path::{Path, PathBuf},
    sync::atomic::{AtomicU64, Ordering},
    time::{SystemTime, UNIX_EPOCH},
};

const JSON_WRITE_ARTIFACT_KIND: &str = "write";
const JSON_ROLLBACK_ARTIFACT_KIND: &str = "rollback";
const JSON_ARTIFACT_ALLOCATION_ATTEMPTS: usize = 128;
static JSON_ARTIFACT_SEQUENCE: AtomicU64 = AtomicU64::new(0);

pub(super) fn temporary_json_path(path: &Path) -> PathBuf {
    path.with_extension("json.tmp")
}

pub(super) fn backup_json_path(path: &Path) -> PathBuf {
    path.with_extension("json.bak")
}

pub(super) fn pre_repair_json_path(path: &Path) -> PathBuf {
    path.with_extension("json.pre-repair")
}

pub(super) fn backup_exists(path: &Path) -> bool {
    backup_json_path(path).exists()
}

pub(super) fn pre_repair_exists(path: &Path) -> bool {
    pre_repair_json_path(path).exists()
}

fn json_artifact_file_name(path: &Path, kind: &str, nonce: u128, sequence: u64) -> OsString {
    let mut file_name = path
        .file_name()
        .unwrap_or_else(|| std::ffi::OsStr::new("collection.json"))
        .to_os_string();
    file_name.push(format!(
        ".{kind}-{}-{nonce}-{sequence}.tmp",
        std::process::id()
    ));
    file_name
}

fn json_artifact_exists(path: &Path, kind: &str) -> bool {
    let Some(directory) = path.parent() else {
        return false;
    };
    let Some(file_name) = path.file_name() else {
        return false;
    };
    let prefix = format!("{}.{kind}-", file_name.to_string_lossy());

    fs::read_dir(directory).is_ok_and(|entries| {
        entries.filter_map(Result::ok).any(|entry| {
            let candidate = entry.file_name();
            let candidate = candidate.to_string_lossy();
            candidate.starts_with(&prefix) && candidate.ends_with(".tmp")
        })
    })
}

pub(super) fn temporary_json_exists(path: &Path) -> bool {
    temporary_json_path(path).exists()
        || json_artifact_exists(path, JSON_WRITE_ARTIFACT_KIND)
        || json_artifact_exists(path, JSON_ROLLBACK_ARTIFACT_KIND)
}

pub(super) fn recovery_artifacts_exist(path: &Path) -> bool {
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

pub(super) fn sync_parent_directory_best_effort(path: &Path) {
    if let Some(directory) = path.parent() {
        // Best-effort: std directory handles are not portable across supported OSes.
        let _ = File::open(directory).and_then(|file| file.sync_all());
    }
}

struct OwnedJsonArtifact {
    path: PathBuf,
    file: Option<File>,
    owned: bool,
}

impl OwnedJsonArtifact {
    fn create(path: &Path, kind: &str) -> io::Result<Self> {
        for _ in 0..JSON_ARTIFACT_ALLOCATION_ATTEMPTS {
            let nonce = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|duration| duration.as_nanos())
                .unwrap_or_default();
            let sequence = JSON_ARTIFACT_SEQUENCE.fetch_add(1, Ordering::Relaxed);
            let artifact_path =
                path.with_file_name(json_artifact_file_name(path, kind, nonce, sequence));
            match OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&artifact_path)
            {
                Ok(file) => {
                    return Ok(Self {
                        path: artifact_path,
                        file: Some(file),
                        owned: true,
                    })
                }
                Err(error) if error.kind() == io::ErrorKind::AlreadyExists => continue,
                Err(error) => return Err(error),
            }
        }

        Err(io::Error::new(
            io::ErrorKind::AlreadyExists,
            "could not allocate a unique DeKoi JSON artifact",
        ))
    }

    fn path(&self) -> &Path {
        &self.path
    }

    fn file_mut(&mut self) -> &mut File {
        self.file
            .as_mut()
            .expect("owned JSON artifact file should still be open")
    }

    fn close(&mut self) {
        self.file.take();
    }

    fn disarm(&mut self) {
        self.close();
        self.owned = false;
    }

    fn cleanup(&mut self) -> Result<(), String> {
        self.cleanup_as("temp file")
    }

    fn cleanup_as(&mut self, artifact_description: &str) -> Result<(), String> {
        self.close();
        if !self.owned {
            return Ok(());
        }

        match fs::remove_file(&self.path) {
            Ok(()) => {
                self.owned = false;
                Ok(())
            }
            Err(error) if error.kind() == io::ErrorKind::NotFound => {
                self.owned = false;
                Ok(())
            }
            Err(error) => Err(format!(
                "Could not remove DeKoi JSON {artifact_description} '{}'. {error}",
                self.path.to_string_lossy()
            )),
        }
    }
}

impl Drop for OwnedJsonArtifact {
    fn drop(&mut self) {
        self.close();
        if self.owned {
            let _ = fs::remove_file(&self.path);
        }
    }
}

enum BackupState {
    NotRequested,
    NoSourceFile,
    Created { snapshot_path: PathBuf },
    RollbackCreated { artifact: OwnedJsonArtifact },
}

impl BackupState {
    fn created(&self) -> bool {
        matches!(self, BackupState::Created { .. })
    }

    fn recovery_snapshot_path(&self) -> Option<&Path> {
        match self {
            BackupState::Created { snapshot_path } => Some(snapshot_path),
            BackupState::RollbackCreated { artifact } => Some(artifact.path()),
            BackupState::NotRequested | BackupState::NoSourceFile => None,
        }
    }

    fn retained_rollback_message(&self) -> String {
        match self {
            BackupState::RollbackCreated { artifact } => {
                format!(
                    " Rollback file retained at '{}'.",
                    artifact.path().to_string_lossy()
                )
            }
            BackupState::NotRequested | BackupState::NoSourceFile | BackupState::Created { .. } => {
                String::new()
            }
        }
    }

    fn retain_transient_rollback(&mut self) {
        if let BackupState::RollbackCreated { artifact } = self {
            artifact.disarm();
        }
    }

    fn cleanup_transient_rollback(&mut self) -> Result<(), String> {
        match self {
            BackupState::RollbackCreated { artifact } => artifact.cleanup_as("rollback file"),
            BackupState::NotRequested | BackupState::NoSourceFile | BackupState::Created { .. } => {
                Ok(())
            }
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

    Ok(BackupState::Created {
        snapshot_path: backup_path,
    })
}

fn preserve_current_for_rollback(
    path: &Path,
    rollback_description: &str,
) -> Result<BackupState, String> {
    let mut source = match File::open(path) {
        Ok(source) => source,
        Err(error) if error.kind() == io::ErrorKind::NotFound => {
            return Ok(BackupState::NoSourceFile)
        }
        Err(error) => {
            return Err(format!(
                "Could not preserve {rollback_description}. {error}"
            ))
        }
    };
    let mut rollback = OwnedJsonArtifact::create(path, JSON_ROLLBACK_ARTIFACT_KIND)
        .map_err(|error| format!("Could not preserve {rollback_description}. {error}"))?;
    if let Err(error) = io::copy(&mut source, rollback.file_mut()) {
        let cleanup_message = rollback
            .cleanup_as("rollback file")
            .err()
            .map(|cleanup_error| format!(" Cleanup failed: {cleanup_error}"))
            .unwrap_or_default();
        return Err(format!(
            "Could not preserve {rollback_description}. {error}.{cleanup_message}"
        ));
    }
    if let Err(error) = rollback.file_mut().sync_all() {
        let cleanup_message = rollback
            .cleanup_as("rollback file")
            .err()
            .map(|cleanup_error| format!(" Cleanup failed: {cleanup_error}"))
            .unwrap_or_default();
        return Err(format!(
            "Could not sync {rollback_description}. {error}.{cleanup_message}"
        ));
    }
    rollback.close();
    sync_parent_directory_best_effort(rollback.path());

    Ok(BackupState::RollbackCreated { artifact: rollback })
}

fn install_temporary_json_file(
    temporary_path: &Path,
    path: &Path,
    backup_state: &BackupState,
) -> io::Result<()> {
    let replace_existing = backup_state.recovery_snapshot_path().is_some();
    if let Some(snapshot_path) = backup_state.recovery_snapshot_path() {
        ensure_destination_matches_recovery_snapshot(path, snapshot_path)?;
    }
    replace_temporary_json_file(temporary_path, path, replace_existing)
}

fn ensure_destination_matches_recovery_snapshot(
    path: &Path,
    snapshot_path: &Path,
) -> io::Result<()> {
    if files_have_same_contents(path, snapshot_path)? {
        return Ok(());
    }

    Err(io::Error::new(
        io::ErrorKind::AlreadyExists,
        "DeKoi JSON destination changed after its recovery snapshot was captured; refusing to replace concurrent data",
    ))
}

fn files_have_same_contents(left_path: &Path, right_path: &Path) -> io::Result<bool> {
    let left = File::open(left_path)?;
    let right = File::open(right_path)?;
    if left.metadata()?.len() != right.metadata()?.len() {
        return Ok(false);
    }

    let mut left = BufReader::new(left);
    let mut right = BufReader::new(right);
    let mut left_buffer = [0_u8; 8192];
    let mut right_buffer = [0_u8; 8192];
    loop {
        let left_length = left.read(&mut left_buffer)?;
        let right_length = right.read(&mut right_buffer)?;
        if left_length != right_length || left_buffer[..left_length] != right_buffer[..right_length]
        {
            return Ok(false);
        }
        if left_length == 0 {
            return Ok(true);
        }
    }
}

#[cfg(any(not(windows), test))]
fn install_new_json_file_with_atomic_rename<R, L>(
    temporary_path: &Path,
    path: &Path,
    atomic_rename: R,
    hard_link: L,
) -> io::Result<()>
where
    R: FnOnce(&Path, &Path) -> io::Result<()>,
    L: FnOnce(&Path, &Path) -> io::Result<()>,
{
    match atomic_rename(temporary_path, path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == io::ErrorKind::AlreadyExists => Err(error),
        Err(rename_error) => hard_link(temporary_path, path).map_err(|hard_link_error| {
            io::Error::new(
                hard_link_error.kind(),
                format!(
                    "Atomic no-replace rename failed: {rename_error} Hard-link fallback failed: {hard_link_error}"
                ),
            )
        }),
    }
}

#[cfg(any(target_os = "linux", target_os = "macos"))]
fn rename_temporary_json_file_no_replace(temporary_path: &Path, path: &Path) -> io::Result<()> {
    use rustix::fs::{renameat_with, RenameFlags, CWD};

    renameat_with(CWD, temporary_path, CWD, path, RenameFlags::NOREPLACE).map_err(io::Error::from)
}

#[cfg(any(target_os = "linux", target_os = "macos"))]
fn replace_temporary_json_file(
    temporary_path: &Path,
    path: &Path,
    replace_existing: bool,
) -> io::Result<()> {
    if replace_existing {
        return fs::rename(temporary_path, path);
    }

    install_new_json_file_with_atomic_rename(
        temporary_path,
        path,
        rename_temporary_json_file_no_replace,
        |source, destination| fs::hard_link(source, destination),
    )
}

#[cfg(all(not(windows), not(any(target_os = "linux", target_os = "macos"))))]
fn replace_temporary_json_file(
    temporary_path: &Path,
    path: &Path,
    replace_existing: bool,
) -> io::Result<()> {
    if replace_existing {
        fs::rename(temporary_path, path)
    } else {
        fs::hard_link(temporary_path, path)
    }
}

#[cfg(windows)]
fn replace_temporary_json_file(
    temporary_path: &Path,
    path: &Path,
    replace_existing: bool,
) -> io::Result<()> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::{
        MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH,
    };

    let temporary_path: Vec<u16> = temporary_path
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();
    let path: Vec<u16> = path
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    // SAFETY: Both pointers reference null-terminated buffers that remain alive for the call.
    let flags = if replace_existing {
        MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH
    } else {
        MOVEFILE_WRITE_THROUGH
    };
    let moved = unsafe { MoveFileExW(temporary_path.as_ptr(), path.as_ptr(), flags) };
    if moved == 0 {
        Err(io::Error::last_os_error())
    } else {
        Ok(())
    }
}

pub(crate) fn write_export_json_file(
    path: &Path,
    value: &serde_json::Value,
    path_category: &str,
) -> Result<(), String> {
    ensure_json_parent_directory(path)?;
    let rollback_description = format!("existing {path_category} for replacement");
    let rollback_state = preserve_current_for_rollback(path, &rollback_description)?;
    write_json_file_with_backup_state(
        path,
        value,
        path_category,
        rollback_state,
        install_temporary_json_file,
    )
}

pub(super) fn write_collection_json_file(
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

pub(super) fn write_repair_json_file(
    path: &Path,
    value: &serde_json::Value,
    path_category: &str,
) -> Result<(), String> {
    ensure_json_parent_directory(path)?;
    let backup_state = preserve_pre_repair_json(path)?;
    write_json_file_with_backup_state(
        path,
        value,
        path_category,
        backup_state,
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

fn preserve_pre_repair_json(path: &Path) -> Result<BackupState, String> {
    let pre_repair_path = pre_repair_json_path(path);
    if pre_repair_path.exists() {
        return preserve_current_for_rollback(path, "DeKoi collection for repair rollback");
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
        snapshot_path: pre_repair_path,
    })
}

fn cleanup_json_write_artifacts(
    temporary: Option<&mut OwnedJsonArtifact>,
    backup_state: &mut BackupState,
) -> Vec<String> {
    let mut failures = Vec::new();
    if let Some(temporary) = temporary {
        if let Err(error) = temporary.cleanup() {
            failures.push(error);
        }
    }
    if let Err(error) = backup_state.cleanup_transient_rollback() {
        failures.push(error);
    }
    failures
}

fn cleanup_failure_suffix(failures: &[String]) -> String {
    if failures.is_empty() {
        String::new()
    } else {
        format!(" Cleanup failed: {}", failures.join(" "))
    }
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
    let mut backup_state = backup_state;
    let contents = match serde_json::to_string_pretty(value) {
        Ok(contents) => contents,
        Err(error) => {
            let failures = cleanup_json_write_artifacts(None, &mut backup_state);
            return Err(format!(
                "Could not serialize DeKoi runtime data. {error}.{}",
                cleanup_failure_suffix(&failures)
            ));
        }
    };
    let mut temporary = match OwnedJsonArtifact::create(path, JSON_WRITE_ARTIFACT_KIND) {
        Ok(temporary) => temporary,
        Err(error) => {
            let failures = cleanup_json_write_artifacts(None, &mut backup_state);
            return Err(format!(
                "Could not write DeKoi runtime data. {error}.{}",
                cleanup_failure_suffix(&failures)
            ));
        }
    };
    if let Err(error) = temporary.file_mut().write_all(contents.as_bytes()) {
        let failures = cleanup_json_write_artifacts(Some(&mut temporary), &mut backup_state);
        return Err(format!(
            "Could not write DeKoi runtime data. {error}.{}",
            cleanup_failure_suffix(&failures)
        ));
    }
    if let Err(error) = temporary.file_mut().sync_all() {
        let failures = cleanup_json_write_artifacts(Some(&mut temporary), &mut backup_state);
        return Err(format!(
            "Could not sync DeKoi runtime data. {error}.{}",
            cleanup_failure_suffix(&failures)
        ));
    }
    temporary.close();

    let install_result = installer(temporary.path(), path, &backup_state);

    if let Err(error) = install_result {
        let cleanup_failures = temporary.cleanup().err().into_iter().collect::<Vec<_>>();
        let cleanup_message = cleanup_failure_suffix(&cleanup_failures);
        let rollback_message = backup_state.retained_rollback_message();
        backup_state.retain_transient_rollback();
        return Err(format!(
            "Could not save DeKoi JSON data (path category: {path_category}; backup created: {}). {error}.{cleanup_message}{rollback_message}",
            yes_no(backup_state.created()),
        ));
    }

    sync_file_best_effort(path);
    sync_parent_directory_best_effort(path);
    let cleanup_failures = cleanup_json_write_artifacts(Some(&mut temporary), &mut backup_state);
    if !cleanup_failures.is_empty() {
        return Err(format!(
            "DeKoi JSON data was saved to '{}', but cleanup failed: {}",
            path.to_string_lossy(),
            cleanup_failures.join(" ")
        ));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_test_dir(name: &str) -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("test clock should be after Unix epoch")
            .as_nanos();
        let path = std::env::temp_dir().join(format!(
            "dekoi-storage-json-{name}-{}-{unique}",
            std::process::id()
        ));
        fs::create_dir_all(&path).expect("test directory should be created");
        path
    }

    fn read_json(path: &Path) -> serde_json::Value {
        serde_json::from_str(&fs::read_to_string(path).expect("test JSON should be readable"))
            .expect("test JSON should parse")
    }

    fn rollback_file_count(directory: &Path) -> usize {
        fs::read_dir(directory)
            .expect("test directory should be readable")
            .filter_map(Result::ok)
            .filter(|entry| entry.file_name().to_string_lossy().contains(".rollback-"))
            .count()
    }

    #[test]
    fn collection_write_backs_up_previous_value_before_replacement() {
        let directory = temp_test_dir("collection-backup");
        let path = directory.join("characters.json");
        let old_value = serde_json::json!([{ "id": "old" }]);
        let new_value = serde_json::json!([{ "id": "new" }]);
        write_collection_json_file(&path, &old_value, "collection file")
            .expect("initial write should succeed");

        write_collection_json_file(&path, &new_value, "collection file")
            .expect("replacement should succeed");

        assert_eq!(read_json(&path), new_value);
        assert_eq!(read_json(&backup_json_path(&path)), old_value);
        assert!(!temporary_json_exists(&path));
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn collection_write_aborts_before_temp_creation_when_backup_fails() {
        let directory = temp_test_dir("backup-failure");
        let path = directory.join("characters.json");
        let backup_path = backup_json_path(&path);
        let old_value = serde_json::json!([{ "id": "old" }]);
        let new_value = serde_json::json!([{ "id": "new" }]);
        fs::write(&path, old_value.to_string()).expect("old collection should be written");
        fs::create_dir(&backup_path).expect("backup path should be blocked by a directory");

        let error = write_collection_json_file(&path, &new_value, "collection file")
            .expect_err("backup failure should abort the write");

        assert!(error.contains("Could not create DeKoi JSON backup"));
        assert_eq!(read_json(&path), old_value);
        assert!(!temporary_json_exists(&path));
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn install_failure_preserves_concurrent_destination_and_cleans_temp() {
        let directory = temp_test_dir("install-failure");
        let path = directory.join("characters.json");
        let old_value = serde_json::json!([{ "id": "old" }]);
        let new_value = serde_json::json!([{ "id": "new" }]);
        let concurrent_value = serde_json::json!([{ "id": "concurrent" }]);
        write_collection_json_file(&path, &old_value, "collection file")
            .expect("initial write should succeed");

        let error = write_json_file_with_installer(
            &path,
            &new_value,
            "collection file",
            true,
            |_temporary_path, target_path, backup_state| {
                assert!(backup_state.created());
                fs::write(target_path, concurrent_value.to_string())?;
                Err(io::Error::other("simulated install failure"))
            },
        )
        .expect_err("simulated install failure should be reported");

        assert!(error.contains("backup created: yes"));
        assert_eq!(read_json(&path), concurrent_value);
        assert_eq!(read_json(&backup_json_path(&path)), old_value);
        assert!(!temporary_json_exists(&path));
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn collection_write_rejects_destination_changed_after_backup_capture() {
        let directory = temp_test_dir("collection-concurrent-replacement");
        let path = directory.join("characters.json");
        let old_value = serde_json::json!([{ "id": "old" }]);
        let new_value = serde_json::json!([{ "id": "new" }]);
        let concurrent_value = serde_json::json!([{ "id": "concurrent" }]);
        write_collection_json_file(&path, &old_value, "collection file")
            .expect("initial write should succeed");

        let error = write_json_file_with_installer(
            &path,
            &new_value,
            "collection file",
            true,
            |temporary_path, target_path, backup_state| {
                fs::write(target_path, concurrent_value.to_string())?;
                install_temporary_json_file(temporary_path, target_path, backup_state)
            },
        )
        .expect_err("a destination changed after backup capture must reject installation");

        assert!(error.contains("destination changed after its recovery snapshot was captured"));
        assert_eq!(read_json(&path), concurrent_value);
        assert_eq!(read_json(&backup_json_path(&path)), old_value);
        assert!(!temporary_json_exists(&path));
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn collection_write_cleans_temp_when_created_backup_disappears() {
        let directory = temp_test_dir("missing-created-backup");
        let path = directory.join("characters.json");
        let backup_path = backup_json_path(&path);
        let old_value = serde_json::json!([{ "id": "old" }]);
        let new_value = serde_json::json!([{ "id": "new" }]);
        write_collection_json_file(&path, &old_value, "collection file")
            .expect("initial write should succeed");

        let error = write_json_file_with_installer(
            &path,
            &new_value,
            "collection file",
            true,
            |_temporary_path, _target_path, backup_state| {
                assert!(matches!(backup_state, BackupState::Created { .. }));
                fs::remove_file(&backup_path)?;
                Err(io::Error::other("simulated missing backup failure"))
            },
        )
        .expect_err("simulated install failure should be reported");

        assert!(error.contains("backup created: yes"));
        assert_eq!(read_json(&path), old_value);
        assert!(!backup_path.exists());
        assert!(!temporary_json_exists(&path));
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn export_install_failure_retains_rollback_and_preserves_concurrent_destination() {
        let directory = temp_test_dir("export-install-failure");
        let path = directory.join("Portable Preset.json");
        let old_value = serde_json::json!({ "version": 1 });
        let new_value = serde_json::json!({ "version": 2 });
        let concurrent_value = serde_json::json!({ "source": "other writer" });
        write_export_json_file(&path, &old_value, "prompt preset file")
            .expect("initial export should succeed");
        let rollback_state =
            preserve_current_for_rollback(&path, "existing prompt preset file for replacement")
                .expect("rollback should be created");

        let error = write_json_file_with_backup_state(
            &path,
            &new_value,
            "prompt preset file",
            rollback_state,
            |_temporary_path, target_path, backup_state| {
                assert!(matches!(backup_state, BackupState::RollbackCreated { .. }));
                fs::write(target_path, concurrent_value.to_string())?;
                Err(io::Error::other("simulated install failure"))
            },
        )
        .expect_err("simulated install failure should be reported");

        assert!(error.contains("Rollback file retained at"));
        assert_eq!(read_json(&path), concurrent_value);
        assert_eq!(rollback_file_count(&directory), 1);
        assert!(!json_artifact_exists(&path, JSON_WRITE_ARTIFACT_KIND));
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn export_write_rejects_destination_changed_after_rollback_capture() {
        let directory = temp_test_dir("export-concurrent-replacement");
        let path = directory.join("Portable Preset.json");
        let old_value = serde_json::json!({ "version": 1 });
        let new_value = serde_json::json!({ "version": 2 });
        let concurrent_value = serde_json::json!({ "source": "other writer" });
        write_export_json_file(&path, &old_value, "prompt preset file")
            .expect("initial export should succeed");
        let rollback_state =
            preserve_current_for_rollback(&path, "existing prompt preset file for replacement")
                .expect("rollback should be created");

        let error = write_json_file_with_backup_state(
            &path,
            &new_value,
            "prompt preset file",
            rollback_state,
            |temporary_path, target_path, backup_state| {
                fs::write(target_path, concurrent_value.to_string())?;
                install_temporary_json_file(temporary_path, target_path, backup_state)
            },
        )
        .expect_err("a destination changed after rollback capture must reject installation");

        assert!(error.contains("destination changed after its recovery snapshot was captured"));
        assert_eq!(read_json(&path), concurrent_value);
        assert_eq!(rollback_file_count(&directory), 1);
        assert!(!json_artifact_exists(&path, JSON_WRITE_ARTIFACT_KIND));
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn repeat_export_replaces_destination_without_backup_or_artifacts() {
        let directory = temp_test_dir("repeat-export");
        let path = directory.join("Portable Preset.json");
        let old_value = serde_json::json!({ "version": 1 });
        let new_value = serde_json::json!({ "version": 2 });
        write_export_json_file(&path, &old_value, "prompt preset file")
            .expect("initial export should succeed");

        write_export_json_file(&path, &new_value, "prompt preset file")
            .expect("repeat export should succeed");

        assert_eq!(read_json(&path), new_value);
        assert!(!backup_json_path(&path).exists());
        assert!(!temporary_json_exists(&path));
        assert_eq!(
            fs::read_dir(&directory)
                .expect("export directory should be readable")
                .count(),
            1
        );
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn temporary_artifacts_are_unique_and_cleanup_is_owned() {
        let directory = temp_test_dir("temp-ownership");
        let path = directory.join("Portable Preset.json");
        let mut first = OwnedJsonArtifact::create(&path, JSON_WRITE_ARTIFACT_KIND)
            .expect("first artifact should be created");
        let mut second = OwnedJsonArtifact::create(&path, JSON_WRITE_ARTIFACT_KIND)
            .expect("second artifact should be created");
        first.file_mut().write_all(b"first").expect("first write");
        second
            .file_mut()
            .write_all(b"second")
            .expect("second write");
        first.close();
        second.close();
        let first_path = first.path().to_path_buf();
        let second_path = second.path().to_path_buf();

        assert_ne!(first_path, second_path);
        first.cleanup().expect("first cleanup should succeed");
        assert!(!first_path.exists());
        assert_eq!(
            fs::read_to_string(&second_path).expect("second artifact should remain"),
            "second"
        );
        second.cleanup().expect("second cleanup should succeed");
        assert!(!temporary_json_exists(&path));
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn atomic_no_replace_rejects_raced_destination_without_hard_link_fallback() {
        let directory = temp_test_dir("no-replace-race");
        let path = directory.join("Portable Preset.json");
        let temporary_path = directory.join("owned-temp.json");
        fs::write(&temporary_path, r#"{"source":"dekoi"}"#).expect("temp fixture");
        fs::write(&path, r#"{"source":"other-process"}"#).expect("destination fixture");

        let error = install_new_json_file_with_atomic_rename(
            &temporary_path,
            &path,
            |_source, _destination| {
                Err(io::Error::new(
                    io::ErrorKind::AlreadyExists,
                    "simulated race",
                ))
            },
            |_source, _destination| panic!("hard-link fallback must not run after a race"),
        )
        .expect_err("raced destination should be rejected");

        assert_eq!(error.kind(), io::ErrorKind::AlreadyExists);
        assert_eq!(
            fs::read_to_string(&path).expect("destination should remain"),
            r#"{"source":"other-process"}"#
        );
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn repair_write_preserves_original_pre_repair_bytes() {
        let directory = temp_test_dir("repair-preservation");
        let path = directory.join("characters.json");
        fs::write(&path, "{").expect("invalid collection should be written");

        write_repair_json_file(
            &path,
            &serde_json::json!([]),
            "collection repair replacement",
        )
        .expect("repair write should succeed");

        assert_eq!(read_json(&path), serde_json::json!([]));
        assert_eq!(
            fs::read_to_string(pre_repair_json_path(&path))
                .expect("pre-repair artifact should remain"),
            "{"
        );
        assert!(!temporary_json_exists(&path));
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn repair_restore_failure_preserves_concurrent_file_and_existing_pre_repair() {
        let directory = temp_test_dir("repair-restore-install-failure");
        let path = directory.join("characters.json");
        let backup_value = serde_json::json!([{ "id": "backup" }]);
        let concurrent_value = serde_json::json!([{ "id": "concurrent" }]);
        fs::write(&path, "{").expect("invalid collection should be written");
        fs::write(pre_repair_json_path(&path), "previous pre-repair")
            .expect("pre-repair fixture should be written");
        let backup_state =
            preserve_pre_repair_json(&path).expect("rollback state should be created");

        let error = write_json_file_with_backup_state(
            &path,
            &backup_value,
            "collection repair restore",
            backup_state,
            |_temporary_path, target_path, _backup_state| {
                fs::write(target_path, concurrent_value.to_string())?;
                Err(io::Error::other("simulated install failure"))
            },
        )
        .expect_err("simulated repair failure should be reported");

        assert!(error.contains("Rollback file retained at"));
        assert_eq!(read_json(&path), concurrent_value);
        assert_eq!(
            fs::read_to_string(pre_repair_json_path(&path))
                .expect("pre-repair fixture should remain"),
            "previous pre-repair"
        );
        assert_eq!(rollback_file_count(&directory), 1);
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn repair_replace_failure_preserves_concurrent_file_and_new_pre_repair() {
        let directory = temp_test_dir("repair-replace-install-failure");
        let path = directory.join("characters.json");
        let concurrent_value = serde_json::json!([{ "id": "concurrent" }]);
        fs::write(&path, "{").expect("invalid collection should be written");
        let backup_state =
            preserve_pre_repair_json(&path).expect("pre-repair state should be created");

        let error = write_json_file_with_backup_state(
            &path,
            &serde_json::json!([]),
            "collection repair replacement",
            backup_state,
            |_temporary_path, target_path, _backup_state| {
                fs::write(target_path, concurrent_value.to_string())?;
                Err(io::Error::other("simulated install failure"))
            },
        )
        .expect_err("simulated repair failure should be reported");

        assert!(error.contains("backup created: yes"));
        assert_eq!(read_json(&path), concurrent_value);
        assert_eq!(
            fs::read_to_string(pre_repair_json_path(&path))
                .expect("pre-repair fixture should remain"),
            "{"
        );
        assert_eq!(rollback_file_count(&directory), 0);
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn export_does_not_touch_unowned_legacy_temp_file() {
        let directory = temp_test_dir("unowned-legacy-temp");
        let path = directory.join("Portable Preset.json");
        let unowned_temp_path = temporary_json_path(&path);
        fs::write(&unowned_temp_path, "another operation's temporary data")
            .expect("legacy temp fixture should be written");

        write_export_json_file(
            &path,
            &serde_json::json!({ "version": 1 }),
            "prompt preset file",
        )
        .expect("export should succeed");

        assert_eq!(
            fs::read_to_string(&unowned_temp_path).expect("legacy temp should remain"),
            "another operation's temporary data"
        );
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn committed_export_reports_rollback_cleanup_failure() {
        let directory = temp_test_dir("rollback-cleanup-failure");
        let path = directory.join("Portable Preset.json");
        let rollback_path = directory.join("owned-rollback-directory");
        fs::create_dir(&rollback_path).expect("rollback fixture should be a directory");

        let error = write_json_file_with_backup_state(
            &path,
            &serde_json::json!({ "version": 1 }),
            "prompt preset file",
            BackupState::RollbackCreated {
                artifact: OwnedJsonArtifact {
                    path: rollback_path.clone(),
                    file: None,
                    owned: true,
                },
            },
            |temporary_path, target_path, _backup_state| fs::rename(temporary_path, target_path),
        )
        .expect_err("committed export should report rollback cleanup failure");

        assert!(error.contains("was saved"));
        assert!(error.contains("rollback"));
        assert!(error.contains(&rollback_path.to_string_lossy().into_owned()));
        assert!(rollback_path.exists());
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn temp_allocation_failure_cleans_owned_rollback() {
        let directory = temp_test_dir("temp-allocation-failure");
        let path = directory
            .join("missing-parent")
            .join("Portable Preset.json");
        let rollback_path = directory.join("owned-rollback.json");
        fs::write(&rollback_path, "previous export").expect("rollback fixture should be written");

        write_json_file_with_backup_state(
            &path,
            &serde_json::json!({ "version": 1 }),
            "prompt preset file",
            BackupState::RollbackCreated {
                artifact: OwnedJsonArtifact {
                    path: rollback_path.clone(),
                    file: None,
                    owned: true,
                },
            },
            install_temporary_json_file,
        )
        .expect_err("missing parent should prevent temp allocation");

        assert!(!rollback_path.exists());
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn atomic_no_replace_install_does_not_require_hard_links() {
        let directory = temp_test_dir("atomic-no-replace");
        let path = directory.join("Portable Preset.json");

        write_json_file_with_backup_state(
            &path,
            &serde_json::json!({ "source": "dekoi" }),
            "prompt preset file",
            BackupState::NoSourceFile,
            |temporary_path, destination, _backup_state| {
                install_new_json_file_with_atomic_rename(
                    temporary_path,
                    destination,
                    |source, destination| fs::rename(source, destination),
                    |_source, _destination| {
                        Err(io::Error::new(
                            io::ErrorKind::Unsupported,
                            "simulated unsupported hard link",
                        ))
                    },
                )
            },
        )
        .expect("atomic rename should install the destination");

        assert_eq!(read_json(&path), serde_json::json!({ "source": "dekoi" }));
        assert!(!temporary_json_exists(&path));
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn missing_temporary_file_does_not_remove_existing_destination() {
        let directory = temp_test_dir("missing-temp-install");
        let path = directory.join("Portable Preset.json");
        fs::write(&path, r#"{"version":1}"#).expect("destination fixture should be written");

        install_temporary_json_file(
            &temporary_json_path(&path),
            &path,
            &BackupState::NotRequested,
        )
        .expect_err("missing temp should fail");

        assert_eq!(
            fs::read_to_string(&path).expect("destination should remain"),
            r#"{"version":1}"#
        );
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn native_install_failure_with_rollback_preserves_existing_destination() {
        let directory = temp_test_dir("native-install-failure");
        let path = directory.join("Portable Preset.json");
        let old_contents = r#"{"version":1}"#;
        fs::write(&path, old_contents).expect("destination fixture should be written");
        let mut rollback_state =
            preserve_current_for_rollback(&path, "existing prompt preset file for replacement")
                .expect("rollback should be created");

        install_temporary_json_file(&temporary_json_path(&path), &path, &rollback_state)
            .expect_err("missing temporary file should fail");

        assert_eq!(
            fs::read_to_string(&path).expect("destination should remain"),
            old_contents
        );
        rollback_state
            .cleanup_transient_rollback()
            .expect("rollback should be removable");
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn transient_rollbacks_are_unique_and_cleanup_is_owned() {
        let directory = temp_test_dir("rollback-ownership");
        let path = directory.join("Portable Preset.json");
        fs::write(&path, r#"{"version":1}"#).expect("destination fixture should be written");
        let mut first = preserve_current_for_rollback(&path, "first rollback")
            .expect("first rollback should be created");
        let mut second = preserve_current_for_rollback(&path, "second rollback")
            .expect("second rollback should be created");
        let (first_path, second_path) = match (&first, &second) {
            (
                BackupState::RollbackCreated {
                    artifact: first_artifact,
                },
                BackupState::RollbackCreated {
                    artifact: second_artifact,
                },
            ) => (
                first_artifact.path().to_path_buf(),
                second_artifact.path().to_path_buf(),
            ),
            _ => panic!("both rollback states should own files"),
        };

        assert_ne!(first_path, second_path);
        first
            .cleanup_transient_rollback()
            .expect("first rollback should be removed");
        assert!(!first_path.exists());
        assert!(second_path.exists());
        second
            .cleanup_transient_rollback()
            .expect("second rollback should be removed");
        let _ = fs::remove_dir_all(directory);
    }

    #[cfg(any(target_os = "linux", target_os = "macos"))]
    #[test]
    fn native_no_replace_rename_preserves_existing_destination() {
        let directory = temp_test_dir("native-no-replace-race");
        let path = directory.join("Portable Preset.json");
        let temporary_path = directory.join("owned-temp.json");
        fs::write(&temporary_path, r#"{"source":"dekoi"}"#).expect("temp fixture");
        fs::write(&path, r#"{"source":"other-process"}"#).expect("destination fixture");

        let error = rename_temporary_json_file_no_replace(&temporary_path, &path)
            .expect_err("native no-replace rename should reject the race");

        assert_eq!(error.kind(), io::ErrorKind::AlreadyExists);
        assert_eq!(
            fs::read_to_string(&path).expect("destination should remain"),
            r#"{"source":"other-process"}"#
        );
        assert!(temporary_path.exists());
        let _ = fs::remove_dir_all(directory);
    }

    #[cfg(windows)]
    #[test]
    fn new_destination_race_does_not_overwrite_another_file() {
        let directory = temp_test_dir("windows-new-destination-race");
        let path = directory.join("Portable Preset.json");
        let temporary_path = temporary_json_path(&path);
        fs::write(&temporary_path, r#"{"source":"dekoi"}"#).expect("temp fixture");
        fs::write(&path, r#"{"source":"other-process"}"#).expect("destination fixture");

        install_temporary_json_file(&temporary_path, &path, &BackupState::NoSourceFile)
            .expect_err("raced destination should not be replaced");

        assert_eq!(
            fs::read_to_string(&path).expect("destination should remain"),
            r#"{"source":"other-process"}"#
        );
        let _ = fs::remove_dir_all(directory);
    }
}
