use crate::storage::{bundle_info, write_bundle_file, StorageBundleInfo, StorageBundleSnapshot};
use std::{
    fs,
    path::{Path, PathBuf},
};

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

#[tauri::command]
pub(crate) fn dekoi_file_export_bundle(
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
pub(crate) fn dekoi_file_import_bundle() -> Result<Option<StorageBundleSnapshot>, String> {
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
