use crate::secrets::provider_secret_read_for_scope;

pub(super) fn provider_connection_requires_api_key(provider: &str) -> bool {
    matches!(
        provider,
        "openai" | "anthropic" | "google" | "mistral" | "cohere" | "openrouter" | "nanogpt" | "xai"
    )
}

pub(super) fn provider_connection_api_key(
    provider: &str,
    connection: &serde_json::Map<String, serde_json::Value>,
) -> Result<String, String> {
    let explicit_key = connection
        .get("apiKey")
        .and_then(|value| value.as_str())
        .unwrap_or("")
        .trim();
    if !explicit_key.is_empty() {
        return Ok(explicit_key.to_string());
    }

    let connection_id = connection
        .get("id")
        .and_then(|value| value.as_str())
        .unwrap_or("")
        .trim();
    if connection_id.is_empty() {
        if provider_connection_requires_api_key(provider) {
            return Err("Provider connection needs an API key before it can make provider requests. Re-enter the key.".to_string());
        }
        return Ok(String::new());
    }

    let base_url = connection
        .get("baseUrl")
        .and_then(|value| value.as_str())
        .unwrap_or("")
        .trim();

    let status = connection
        .get("status")
        .and_then(|value| value.as_str())
        .unwrap_or("")
        .trim();
    if status != "ready" {
        if provider_connection_requires_api_key(provider) {
            return Err("Provider connection needs an API key before it can make provider requests. Re-enter the key.".to_string());
        }
        return Ok(String::new());
    }

    if !provider_connection_requires_api_key(provider) {
        return Ok(
            provider_secret_read_for_scope(connection_id, provider, base_url, false)
                .ok()
                .flatten()
                .unwrap_or_default(),
        );
    }

    match provider_secret_read_for_scope(connection_id, provider, base_url, false)? {
        Some(secret) if !secret.trim().is_empty() => Ok(secret),
        _ => Err("Provider connection needs an API key before it can make provider requests. Re-enter the key.".to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn optional_provider_does_not_require_stored_secret() {
        let mut connection = serde_json::Map::new();
        connection.insert("id".to_string(), serde_json::json!("custom-missing"));
        connection.insert("status".to_string(), serde_json::json!("ready"));

        let api_key = provider_connection_api_key("custom", &connection)
            .expect("Optional-key providers should ignore missing stored secrets");

        assert_eq!(api_key, "");
    }

    #[test]
    fn required_provider_without_key_is_rejected_before_request() {
        let mut connection = serde_json::Map::new();
        connection.insert("provider".to_string(), serde_json::json!("openai"));

        let error = provider_connection_api_key("openai", &connection)
            .expect_err("Required-key providers need an explicit or stored key");

        assert!(error.contains("needs an API key"));
    }

    #[test]
    fn required_provider_needs_ready_status_for_stored_secret() {
        let mut connection = serde_json::Map::new();
        connection.insert("id".to_string(), serde_json::json!("connection-openai"));
        connection.insert("status".to_string(), serde_json::json!("needs-key"));

        let error = provider_connection_api_key("openai", &connection)
            .expect_err("Non-ready required providers must stop before HTTP");

        assert!(error.contains("needs an API key"));
    }
}
