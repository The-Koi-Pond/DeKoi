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
