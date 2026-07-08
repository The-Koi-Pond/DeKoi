pub(super) fn append_endpoint(base_url: &str, endpoint: &str) -> String {
    let trimmed = base_url.trim().trim_end_matches('/');
    if trimmed.ends_with(endpoint) {
        trimmed.to_string()
    } else {
        format!("{trimmed}{endpoint}")
    }
}

pub(super) fn append_openai_chat_completions_endpoint(base_url: &str) -> String {
    let trimmed = base_url.trim().trim_end_matches('/');
    if trimmed.ends_with("/chat/completions") {
        return trimmed.to_string();
    }

    let lower = trimmed.to_lowercase();
    if lower.ends_with("/api/v1")
        || lower.ends_with("/v1")
        || lower.ends_with("/api/v2")
        || lower.ends_with("/v2")
    {
        return format!("{trimmed}/chat/completions");
    }

    format!("{trimmed}/v1/chat/completions")
}
