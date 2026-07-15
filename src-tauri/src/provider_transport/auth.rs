use crate::secrets::provider_secret_read_for_scope;

const PROVIDER_API_KEY_REQUIRED_ERROR: &str = "Provider connection needs an API key before it can make provider requests. Re-enter the key.";

pub(super) fn provider_connection_requires_api_key(provider: &str) -> bool {
    matches!(
        provider,
        "openai" | "anthropic" | "google" | "mistral" | "cohere" | "openrouter" | "nanogpt" | "xai"
    )
}

fn resolve_provider_connection_api_key(
    provider: &str,
    connection_id: &str,
    ready: bool,
    read_secret: impl FnOnce() -> Result<Option<String>, String>,
) -> Result<String, String> {
    let requires_key = provider_connection_requires_api_key(provider);
    if connection_id.trim().is_empty() || !ready {
        if requires_key {
            return Err(PROVIDER_API_KEY_REQUIRED_ERROR.to_string());
        }
        return Ok(String::new());
    }

    let secret = if requires_key {
        read_secret()?
    } else {
        read_secret().ok().flatten()
    };
    match secret {
        Some(secret) if !secret.trim().is_empty() => Ok(secret),
        _ if requires_key => Err(PROVIDER_API_KEY_REQUIRED_ERROR.to_string()),
        _ => Ok(String::new()),
    }
}

pub(super) fn provider_connection_api_key_for_scope(
    provider: &str,
    connection_id: &str,
    base_url: &str,
    ready: bool,
) -> Result<String, String> {
    resolve_provider_connection_api_key(provider, connection_id, ready, || {
        provider_secret_read_for_scope(connection_id, provider, base_url, false)
    })
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
    provider_connection_api_key_for_scope(provider, connection_id, base_url, status == "ready")
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
    fn optional_provider_ignores_secret_store_read_failures() {
        let api_key = resolve_provider_connection_api_key(
            "custom",
            "connection-custom",
            true,
            || Err("Credential store unavailable".to_string()),
        )
        .expect("Optional-key providers should tolerate secret-store failures");

        assert_eq!(api_key, "");
    }

    #[test]
    fn required_provider_propagates_secret_store_read_failures() {
        let error = resolve_provider_connection_api_key(
            "openai",
            "connection-openai",
            true,
            || Err("Credential store unavailable".to_string()),
        )
        .expect_err("Required-key providers should surface secret-store failures");

        assert_eq!(error, "Credential store unavailable");
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
