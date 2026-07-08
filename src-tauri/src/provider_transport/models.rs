use super::{
    auth::{provider_connection_api_key, provider_connection_requires_api_key},
    endpoints::append_endpoint,
    http::{
        provider_error, provider_headers, provider_http_client, provider_json_payload,
        provider_request_error,
    },
    value::as_object,
    PROVIDER_CONNECTION_TIMEOUT,
};
use crate::runtime_args::runtime_args_object;

fn provider_connection_models_url(provider: &str, base_url: &str) -> Result<String, String> {
    if provider.trim().is_empty() || base_url.trim().is_empty() {
        return Err("Provider connection needs provider and base URL.".to_string());
    }
    if !provider_connection_supports_models(provider) {
        return Err(format!(
            "{provider} does not support model listing through this runtime."
        ));
    }

    Ok(append_endpoint(base_url, "/models"))
}

fn provider_connection_supports_models(provider: &str) -> bool {
    matches!(
        provider,
        "openai"
            | "anthropic"
            | "google"
            | "mistral"
            | "cohere"
            | "openrouter"
            | "nanogpt"
            | "xai"
            | "custom"
    )
}

fn provider_connection_models_request(
    provider: &str,
    base_url: &str,
    api_key: &str,
) -> Result<(String, reqwest::header::HeaderMap), String> {
    if provider_connection_requires_api_key(provider) && api_key.trim().is_empty() {
        return Err("API key required before fetching models.".to_string());
    }

    let url = provider_connection_models_url(provider, base_url)?;
    let headers = provider_headers(provider, api_key)?;
    Ok((url, headers))
}

fn read_model_id(value: &serde_json::Value) -> String {
    if let Some(model) = value.as_str() {
        return model.trim().to_string();
    }

    let Some(record) = value.as_object() else {
        return String::new();
    };

    ["id", "name", "model", "slug"]
        .iter()
        .find_map(|key| {
            record
                .get(*key)
                .and_then(|value| value.as_str())
                .map(|value| value.trim_start_matches("models/").trim().to_string())
                .filter(|value| !value.is_empty())
        })
        .unwrap_or_default()
}

fn parse_provider_models(payload: &serde_json::Value) -> Vec<String> {
    let candidates = if let Some(items) = payload.as_array() {
        Some(items)
    } else {
        payload.as_object().and_then(|record| {
            ["data", "models", "items"]
                .iter()
                .find_map(|key| record.get(*key).and_then(|value| value.as_array()))
        })
    };

    let Some(candidates) = candidates else {
        return Vec::new();
    };

    let mut models = candidates
        .iter()
        .map(read_model_id)
        .filter(|model| !model.is_empty())
        .collect::<Vec<String>>();
    models.sort();
    models.dedup();
    models
}

pub(crate) async fn provider_connection_models(
    args: &serde_json::Value,
) -> Result<serde_json::Value, String> {
    let args = runtime_args_object(args, "provider_connection_models")?;
    let connection = args
        .get("connection")
        .ok_or_else(|| "provider_connection_models requires args.connection.".to_string())?;
    let connection = as_object(connection, "args.connection")?;
    let provider = connection
        .get("provider")
        .and_then(|value| value.as_str())
        .unwrap_or("")
        .trim();
    let base_url = connection
        .get("baseUrl")
        .and_then(|value| value.as_str())
        .unwrap_or("")
        .trim();
    let api_key = provider_connection_api_key(provider, connection)?;
    let (url, headers) = provider_connection_models_request(provider, base_url, &api_key)?;
    let client = provider_http_client(PROVIDER_CONNECTION_TIMEOUT)?;
    let response = client
        .get(url)
        .headers(headers)
        .send()
        .await
        .map_err(|error| {
            provider_request_error("Model fetch", PROVIDER_CONNECTION_TIMEOUT, error)
        })?;
    let (status, payload) =
        provider_json_payload(response, "Model fetch", PROVIDER_CONNECTION_TIMEOUT).await?;
    if !status.is_success() {
        return Err(provider_error(&payload, status));
    }

    Ok(serde_json::json!({
        "models": parse_provider_models(&payload)
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn provider_connection_models_rejects_unsupported_provider() {
        let error =
            provider_connection_models_request("claude_subscription", "https://example.test", "")
                .expect_err("Subscription providers do not expose runtime model listing");

        assert!(error.contains("does not support model listing"));
    }

    #[test]
    fn provider_connection_models_rejects_missing_required_key() {
        let error = provider_connection_models_request("openai", "https://api.openai.com/v1", "")
            .expect_err("OpenAI model listing needs a key before HTTP");

        assert_eq!(error, "API key required before fetching models.");
    }

    #[test]
    fn provider_connection_models_parses_common_shapes() {
        let models = parse_provider_models(&serde_json::json!({
            "data": [
                { "id": "zeta" },
                { "name": "models/alpha" },
                { "model": "zeta" }
            ]
        }));

        assert_eq!(models, vec!["alpha".to_string(), "zeta".to_string()]);
    }

    #[test]
    fn provider_connection_models_empty_payload_has_no_models() {
        let models = parse_provider_models(&serde_json::json!({
            "data": []
        }));

        assert!(models.is_empty());
    }
}
