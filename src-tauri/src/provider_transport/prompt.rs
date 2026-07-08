use crate::runtime_args::read_string_field;

pub(super) fn system_prompt(prompt_messages: &[serde_json::Value]) -> String {
    prompt_messages
        .iter()
        .filter(|message| read_string_field(message, "role") == "system")
        .filter_map(|message| {
            let content = read_string_field(message, "content").trim();
            (!content.is_empty()).then(|| content.to_string())
        })
        .collect::<Vec<String>>()
        .join("\n\n")
}

pub(super) fn non_system_messages(prompt_messages: &[serde_json::Value]) -> Vec<serde_json::Value> {
    prompt_messages
        .iter()
        .filter(|message| read_string_field(message, "role") != "system")
        .cloned()
        .collect()
}

pub(super) fn strip_speaker_prefix(body: String, speaker_name: &str) -> String {
    let trimmed = body.trim();
    let prefix = format!("{speaker_name}:");
    if !speaker_name.trim().is_empty() && trimmed.to_lowercase().starts_with(&prefix.to_lowercase())
    {
        trimmed[prefix.len()..].trim().to_string()
    } else {
        trimmed.to_string()
    }
}
