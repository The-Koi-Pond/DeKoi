use crate::storage::{
    current_unix_ms, read_string_field, runtime_args_object, storage_create, storage_delete,
    storage_list, storage_update,
};

const DESKTOP_RUNTIME_MARKER: &str = "de-koi-desktop";

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

#[tauri::command]
pub(crate) fn dekoi_runtime_health() -> serde_json::Value {
    serde_json::json!({
        "ok": true,
        "runtime": DESKTOP_RUNTIME_MARKER,
        "writable": true
    })
}

#[tauri::command]
pub(crate) fn dekoi_runtime_invoke(
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
