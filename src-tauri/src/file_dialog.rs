use crate::storage::{
    bundle_info, write_bundle_file, write_export_json_file, StorageBundleInfo,
    StorageBundleSnapshot,
};
use std::{
    fs,
    path::{Path, PathBuf},
};

fn safe_default_bundle_file_name(file_name: Option<String>) -> String {
    safe_default_json_file_name(file_name, "dekoi-bundle.json")
}

fn safe_default_prompt_preset_file_name(file_name: Option<String>) -> String {
    safe_default_json_file_name(file_name, "prompt-preset.json")
}

fn safe_default_json_file_name(file_name: Option<String>, fallback: &str) -> String {
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
    if path
        .extension()
        .is_none_or(|extension| extension.is_empty())
    {
        path.set_extension("json");
    }

    path
}

fn prompt_preset_json_path(path: PathBuf) -> Result<PathBuf, String> {
    let path = with_json_extension(path);
    if path
        .extension()
        .is_some_and(|extension| extension.eq_ignore_ascii_case("json"))
    {
        Ok(path)
    } else {
        Err("Prompt preset export requires a .json filename.".to_string())
    }
}

fn write_prompt_preset_file(path: &Path, package: &serde_json::Value) -> Result<(), String> {
    write_export_json_file(path, package, "prompt preset file")
        .map_err(|error| format!("Could not write prompt preset file. {error}"))
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

#[tauri::command]
pub(crate) fn dekoi_file_export_prompt_preset(
    package: serde_json::Value,
    default_file_name: Option<String>,
) -> Result<Option<String>, String> {
    let Some(path) = rfd::FileDialog::new()
        .add_filter("Prompt preset", &["json"])
        .set_file_name(safe_default_prompt_preset_file_name(default_file_name))
        .save_file()
    else {
        return Ok(None);
    };
    let path = prompt_preset_json_path(path)?;

    write_prompt_preset_file(&path, &package)?;
    Ok(Some(path.to_string_lossy().into_owned()))
}

#[tauri::command]
pub(crate) fn dekoi_file_import_prompt_preset() -> Result<Option<String>, String> {
    let Some(path) = rfd::FileDialog::new()
        .add_filter("Prompt preset", &["json"])
        .pick_file()
    else {
        return Ok(None);
    };

    fs::read_to_string(&path)
        .map(Some)
        .map_err(|error| format!("Could not read prompt preset file. {error}"))
}

#[cfg(test)]
mod tests {
    use super::{
        prompt_preset_json_path, safe_default_prompt_preset_file_name, with_json_extension,
    };
    use std::path::PathBuf;

    #[test]
    fn prompt_preset_default_file_name_is_a_safe_json_basename() {
        assert_eq!(
            safe_default_prompt_preset_file_name(Some(" ../named-preset ".to_string())),
            "named-preset"
        );
        assert_eq!(
            safe_default_prompt_preset_file_name(Some("   ".to_string())),
            "prompt-preset.json"
        );
    }

    #[test]
    fn json_extension_is_added_only_when_missing() {
        assert_eq!(
            with_json_extension(PathBuf::from("preset")),
            PathBuf::from("preset.json")
        );
        assert_eq!(
            with_json_extension(PathBuf::from("preset.marinara.json")),
            PathBuf::from("preset.marinara.json")
        );
    }

    #[test]
    fn prompt_preset_export_rejects_non_json_destinations() {
        assert_eq!(
            prompt_preset_json_path(PathBuf::from("preset")),
            Ok(PathBuf::from("preset.json"))
        );
        assert_eq!(
            prompt_preset_json_path(PathBuf::from("preset.JSON")),
            Ok(PathBuf::from("preset.JSON"))
        );
        assert_eq!(
            prompt_preset_json_path(PathBuf::from("preset.txt")),
            Err("Prompt preset export requires a .json filename.".to_string())
        );
    }
}
