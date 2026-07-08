use super::{
    auth::provider_connection_api_key,
    endpoints::{append_endpoint, append_openai_chat_completions_endpoint},
    http::{post_provider_json, provider_headers, provider_http_client},
    value::as_object,
    PROVIDER_CONNECTION_TIMEOUT,
};
use crate::provider_response::{
    extract_provider_connection_check_text, is_openai_compatible, provider_empty_warning,
};
use crate::runtime_args::runtime_args_object;

struct ProviderConnectionCheckRequest {
    url: String,
    body: serde_json::Value,
}

fn provider_connection_check_request(
    provider: &str,
    base_url: &str,
    model: &str,
) -> Result<ProviderConnectionCheckRequest, String> {
    if provider.trim().is_empty() || base_url.trim().is_empty() || model.trim().is_empty() {
        return Err("Provider connection needs provider, base URL, and model.".to_string());
    }

    if is_openai_compatible(provider) {
        return Ok(ProviderConnectionCheckRequest {
            url: append_openai_chat_completions_endpoint(base_url),
            body: serde_json::json!({
                "model": model,
                "messages": [{ "role": "user", "content": "Reply with OK." }],
                "temperature": 0,
                "max_tokens": 1
            }),
        });
    }

    if provider == "anthropic" {
        return Ok(ProviderConnectionCheckRequest {
            url: append_endpoint(base_url, "/messages"),
            body: serde_json::json!({
                "model": model,
                "messages": [{ "role": "user", "content": "Reply with OK." }],
                "temperature": 0,
                "max_tokens": 1
            }),
        });
    }

    if provider == "google" {
        let normalized_model = model.trim_start_matches("models/");
        return Ok(ProviderConnectionCheckRequest {
            url: format!(
                "{}/models/{}:generateContent",
                base_url.trim_end_matches('/'),
                normalized_model
            ),
            body: serde_json::json!({
                "contents": [{
                    "role": "user",
                    "parts": [{ "text": "Reply with OK." }]
                }],
                "generationConfig": {
                    "temperature": 0,
                    "maxOutputTokens": 1
                }
            }),
        });
    }

    Err(format!(
        "{provider} is not supported by the provider connection checker yet."
    ))
}

fn validate_provider_connection_check_payload(
    provider: &str,
    payload: &serde_json::Value,
) -> Result<(), String> {
    if extract_provider_connection_check_text(provider, payload)
        .trim()
        .is_empty()
    {
        return Err(provider_empty_warning(provider, payload));
    }

    Ok(())
}

pub(crate) async fn provider_connection_check(
    args: &serde_json::Value,
) -> Result<serde_json::Value, String> {
    let args = runtime_args_object(args, "provider_connection_check")?;
    let connection = args
        .get("connection")
        .ok_or_else(|| "provider_connection_check requires args.connection.".to_string())?;
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
    let model = connection
        .get("model")
        .and_then(|value| value.as_str())
        .unwrap_or("")
        .trim();
    let api_key = provider_connection_api_key(provider, connection)?;
    let request = provider_connection_check_request(provider, base_url, model)?;
    let client = provider_http_client(PROVIDER_CONNECTION_TIMEOUT)?;
    let headers = provider_headers(provider, &api_key)?;
    let payload = post_provider_json(
        &client,
        request.url,
        headers,
        request.body,
        PROVIDER_CONNECTION_TIMEOUT,
    )
    .await?;
    validate_provider_connection_check_payload(provider, &payload)?;

    Ok(serde_json::json!({
        "success": true,
        "message": "API key is valid and the selected model can generate."
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn provider_connection_check_uses_openai_generation_endpoint() {
        let request =
            provider_connection_check_request("openai", "https://api.openai.com/v1", "gpt-4o-mini")
                .expect("OpenAI check request should build");

        assert_eq!(request.url, "https://api.openai.com/v1/chat/completions");
        assert_eq!(request.body["model"], "gpt-4o-mini");
        assert_eq!(request.body["max_tokens"], 1);
        assert!(request.body.get("messages").is_some());
    }

    #[test]
    fn provider_connection_check_uses_google_generation_endpoint() {
        let request = provider_connection_check_request(
            "google",
            "https://generativelanguage.googleapis.com/v1beta",
            "models/gemini-2.5-flash",
        )
        .expect("Google check request should build");

        assert_eq!(
            request.url,
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
        );
        assert_eq!(request.body["generationConfig"]["maxOutputTokens"], 1);
    }

    #[test]
    fn provider_connection_check_requires_generated_text() {
        let error = validate_provider_connection_check_payload("openai", &serde_json::json!({}))
            .expect_err("A parseable but empty generation payload should not validate");

        assert_eq!(error, "Provider returned no text (object(no fields)).");
    }

    #[test]
    fn provider_connection_check_rejects_generic_text_for_openai_shape() {
        let error = validate_provider_connection_check_payload(
            "openai",
            &serde_json::json!({
                "message": "OK"
            }),
        )
        .expect_err("Known providers must return their expected generation shape");

        assert_eq!(error, "Provider returned no text (fields: message).");
    }

    #[test]
    fn provider_connection_check_rejects_generic_text_for_google_shape() {
        let error = validate_provider_connection_check_payload(
            "google",
            &serde_json::json!({
                "text": "OK"
            }),
        )
        .expect_err("Google checks must return a candidate payload");

        assert_eq!(error, "Provider returned no text (fields: text).");
    }

    #[test]
    fn provider_connection_check_rejects_generic_text_for_anthropic_shape() {
        let error = validate_provider_connection_check_payload(
            "anthropic",
            &serde_json::json!({
                "message": "OK"
            }),
        )
        .expect_err("Anthropic checks must return a content payload");

        assert_eq!(error, "Provider returned no text (fields: message).");
    }

    #[test]
    fn provider_connection_check_accepts_generated_text() {
        validate_provider_connection_check_payload(
            "openai",
            &serde_json::json!({
                "choices": [{
                    "message": {
                        "content": "OK"
                    }
                }]
            }),
        )
        .expect("Generated text should prove the connection check response");
    }

    #[test]
    fn provider_connection_check_accepts_anthropic_generated_text() {
        validate_provider_connection_check_payload(
            "anthropic",
            &serde_json::json!({
                "content": [{
                    "type": "text",
                    "text": "OK"
                }]
            }),
        )
        .expect("Anthropic content should prove the connection check response");
    }

    #[test]
    fn provider_connection_check_accepts_google_generated_text() {
        validate_provider_connection_check_payload(
            "google",
            &serde_json::json!({
                "candidates": [{
                    "content": {
                        "parts": [{ "text": "OK" }]
                    }
                }]
            }),
        )
        .expect("Google candidates should prove the connection check response");
    }

    #[test]
    fn provider_connection_check_accepts_custom_generic_text() {
        validate_provider_connection_check_payload(
            "custom",
            &serde_json::json!({
                "message": "OK"
            }),
        )
        .expect("Custom provider checks keep the generic response fallback");
    }
}
