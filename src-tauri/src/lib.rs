use std::{fs, path::PathBuf, time::UNIX_EPOCH};
use tauri::Manager;

const STORAGE_BUNDLE_FILE_NAME: &str = "dekoi-storage-bundle.json";
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

fn storage_bundle_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|dir| dir.join(STORAGE_BUNDLE_FILE_NAME))
        .map_err(|error| format!("Could not resolve DeKoi app data directory. {error}"))
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
        runtime_ready: false,
        message: if secrets_ready {
            "Tauri host is available. Durable bundle storage and provider key storage are ready."
        } else {
            "Tauri host is available. Durable bundle storage is ready, but provider key storage is unavailable."
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

    let contents = serde_json::to_string_pretty(&bundle)
        .map_err(|error| format!("Could not serialize DeKoi storage bundle. {error}"))?;
    let temporary_path = path.with_extension("json.tmp");
    fs::write(&temporary_path, contents)
        .map_err(|error| format!("Could not write DeKoi storage bundle. {error}"))?;

    if path.exists() {
        fs::remove_file(&path)
            .map_err(|error| format!("Could not replace DeKoi storage bundle. {error}"))?;
    }
    fs::rename(&temporary_path, &path)
        .map_err(|error| format!("Could not save DeKoi storage bundle. {error}"))?;

    // Ensure a fresh modification time on filesystems with coarse timestamps.
    let _ = fs::OpenOptions::new()
        .append(true)
        .open(&path)
        .and_then(|file| {
            file.sync_all()?;
            Ok(())
        });

    bundle_info(path)
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            dekoi_host_status,
            dekoi_provider_secret_delete,
            dekoi_provider_secret_status,
            dekoi_provider_secret_write,
            dekoi_storage_read_bundle,
            dekoi_storage_write_bundle
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
