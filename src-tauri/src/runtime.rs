use crate::provider_response::{
    extract_provider_connection_check_text, extract_provider_text, is_openai_compatible,
    provider_empty_warning,
};
use crate::secrets::provider_secret_read_for_scope;
use crate::storage::{
    read_string_field, runtime_args_object, storage_create, storage_delete, storage_list,
    storage_replace, storage_update,
};
use std::time::Duration;

const DESKTOP_RUNTIME_MARKER: &str = "de-koi-desktop";
const PROVIDER_CONNECTION_TIMEOUT: Duration = Duration::from_secs(30);
const PROVIDER_GENERATION_TIMEOUT: Duration = Duration::from_secs(120);

fn provider_http_client(timeout: Duration) -> Result<reqwest::Client, String> {
    reqwest::ClientBuilder::new()
        .timeout(timeout)
        .build()
        .map_err(|error| format!("Provider HTTP client failed to initialize. {error}"))
}

fn provider_request_error(action: &str, timeout: Duration, error: reqwest::Error) -> String {
    if error.is_timeout() {
        format!("{action} timed out after {} seconds.", timeout.as_secs())
    } else {
        format!("{action} failed. {error}")
    }
}

fn parse_provider_json_body(
    status: reqwest::StatusCode,
    body: &[u8],
    action: &str,
) -> Result<serde_json::Value, String> {
    if body.is_empty() {
        if status.is_success() {
            return Err(format!("{action} returned an empty response body."));
        }
        return Ok(serde_json::Value::Null);
    }

    serde_json::from_slice::<serde_json::Value>(body).map_err(|error| {
        if status.is_success() {
            format!("{action} returned an invalid JSON response. {error}")
        } else {
            format!(
                "Provider returned HTTP {status}, but the response body was not valid JSON. {error}"
            )
        }
    })
}

async fn provider_json_payload(
    response: reqwest::Response,
    action: &str,
    timeout: Duration,
) -> Result<(reqwest::StatusCode, serde_json::Value), String> {
    let status = response.status();
    let body = response
        .bytes()
        .await
        .map_err(|error| provider_request_error(action, timeout, error))?;
    let payload = parse_provider_json_body(status, &body, action)?;

    Ok((status, payload))
}

fn as_object<'a>(
    value: &'a serde_json::Value,
    name: &str,
) -> Result<&'a serde_json::Map<String, serde_json::Value>, String> {
    value
        .as_object()
        .ok_or_else(|| format!("{name} must be an object."))
}

fn read_number_field(value: &serde_json::Value, key: &str, fallback: f64) -> f64 {
    value
        .get(key)
        .and_then(|field| field.as_f64())
        .filter(|field| field.is_finite())
        .unwrap_or(fallback)
}

fn read_u64_field(value: &serde_json::Value, key: &str, fallback: u64) -> u64 {
    value
        .get(key)
        .and_then(|field| field.as_u64())
        .unwrap_or(fallback)
}

fn append_endpoint(base_url: &str, endpoint: &str) -> String {
    let trimmed = base_url.trim().trim_end_matches('/');
    if trimmed.ends_with(endpoint) {
        trimmed.to_string()
    } else {
        format!("{trimmed}{endpoint}")
    }
}

fn append_openai_chat_completions_endpoint(base_url: &str) -> String {
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

fn provider_connection_requires_api_key(provider: &str) -> bool {
    matches!(
        provider,
        "openai" | "anthropic" | "google" | "mistral" | "cohere" | "openrouter" | "nanogpt" | "xai"
    )
}

fn provider_connection_api_key(
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

fn system_prompt(prompt_messages: &[serde_json::Value]) -> String {
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

fn non_system_messages(prompt_messages: &[serde_json::Value]) -> Vec<serde_json::Value> {
    prompt_messages
        .iter()
        .filter(|message| read_string_field(message, "role") != "system")
        .cloned()
        .collect()
}

fn strip_speaker_prefix(body: String, speaker_name: &str) -> String {
    let trimmed = body.trim();
    let prefix = format!("{speaker_name}:");
    if !speaker_name.trim().is_empty() && trimmed.to_lowercase().starts_with(&prefix.to_lowercase())
    {
        trimmed[prefix.len()..].trim().to_string()
    } else {
        trimmed.to_string()
    }
}

fn provider_error(payload: &serde_json::Value, status: reqwest::StatusCode) -> String {
    let message = provider_payload_error(payload).or_else(|| {
        payload
            .get("message")
            .and_then(|message| message.as_str())
            .map(ToString::to_string)
    });

    match message.map(|message| message.trim().to_string()) {
        Some(message) if !message.is_empty() => {
            format!("Provider returned HTTP {status}: {message}")
        }
        _ => format!("Provider returned HTTP {status}."),
    }
}

fn provider_payload_error(payload: &serde_json::Value) -> Option<String> {
    let error = payload.get("error")?;
    if error.is_null() {
        return None;
    }

    if let Some(message) = error
        .as_str()
        .map(str::trim)
        .filter(|message| !message.is_empty())
    {
        return Some(message.to_string());
    }

    let message = error
        .get("message")
        .and_then(|message| message.as_str())
        .or_else(|| error.get("detail").and_then(|detail| detail.as_str()))
        .or_else(|| error.get("type").and_then(|kind| kind.as_str()))
        .or_else(|| error.get("code").and_then(|code| code.as_str()))
        .unwrap_or("")
        .trim();

    Some(if message.is_empty() {
        "Provider returned an error response.".to_string()
    } else {
        message.to_string()
    })
}

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

async fn provider_connection_check(args: &serde_json::Value) -> Result<serde_json::Value, String> {
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

async fn provider_connection_models(args: &serde_json::Value) -> Result<serde_json::Value, String> {
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

async fn post_provider_json(
    client: &reqwest::Client,
    url: String,
    headers: reqwest::header::HeaderMap,
    body: serde_json::Value,
    timeout: Duration,
) -> Result<serde_json::Value, String> {
    let response = client
        .post(url)
        .headers(headers)
        .json(&body)
        .send()
        .await
        .map_err(|error| provider_request_error("Provider request", timeout, error))?;
    let (status, payload) = provider_json_payload(response, "Provider request", timeout).await?;
    if !status.is_success() {
        return Err(provider_error(&payload, status));
    }

    if let Some(error) = provider_payload_error(&payload) {
        return Err(error);
    }

    Ok(payload)
}

fn provider_headers(provider: &str, api_key: &str) -> Result<reqwest::header::HeaderMap, String> {
    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert(
        reqwest::header::ACCEPT,
        reqwest::header::HeaderValue::from_static("application/json"),
    );
    headers.insert(
        reqwest::header::CONTENT_TYPE,
        reqwest::header::HeaderValue::from_static("application/json"),
    );

    let key = api_key.trim();
    if key.is_empty() {
        return Ok(headers);
    }

    if provider == "anthropic" {
        headers.insert(
            "x-api-key",
            reqwest::header::HeaderValue::from_str(key).map_err(|error| {
                format!("Provider API key is not a valid header value. {error}")
            })?,
        );
        headers.insert(
            "anthropic-version",
            reqwest::header::HeaderValue::from_static("2023-06-01"),
        );
        return Ok(headers);
    }

    if provider == "google" {
        headers.insert(
            "x-goog-api-key",
            reqwest::header::HeaderValue::from_str(key).map_err(|error| {
                format!("Provider API key is not a valid header value. {error}")
            })?,
        );
        return Ok(headers);
    }

    headers.insert(
        reqwest::header::AUTHORIZATION,
        reqwest::header::HeaderValue::from_str(&format!("Bearer {key}"))
            .map_err(|error| format!("Provider API key is not a valid bearer token. {error}"))?,
    );
    Ok(headers)
}

async fn generation_generate(args: &serde_json::Value) -> Result<serde_json::Value, String> {
    let args = runtime_args_object(args, "generation_generate")?;
    let request = args
        .get("request")
        .ok_or_else(|| "generation_generate requires args.request.".to_string())?;
    let request_id = read_string_field(request, "id").trim();
    if request_id.is_empty() {
        return Err("generation_generate request requires id.".to_string());
    }

    let provider_connection = request
        .get("providerConnection")
        .ok_or_else(|| "generation_generate requires request.providerConnection.".to_string())?;
    let provider_connection = as_object(provider_connection, "request.providerConnection")?;
    let provider = provider_connection
        .get("provider")
        .and_then(|value| value.as_str())
        .unwrap_or("")
        .trim();
    let base_url = provider_connection
        .get("baseUrl")
        .and_then(|value| value.as_str())
        .unwrap_or("")
        .trim();
    let model = provider_connection
        .get("model")
        .and_then(|value| value.as_str())
        .unwrap_or("")
        .trim();
    let api_key = provider_connection_api_key(provider, provider_connection)?;
    if provider.is_empty() || base_url.is_empty() || model.is_empty() {
        return Err("Provider connection needs provider, base URL, and model.".to_string());
    }

    let prompt_messages = request
        .get("promptMessages")
        .and_then(|value| value.as_array())
        .ok_or_else(|| "generation_generate requires request.promptMessages.".to_string())?;
    let parameters = request
        .get("parameters")
        .unwrap_or(&serde_json::Value::Null);
    let max_tokens = read_u64_field(parameters, "maxTokens", 1024);
    let temperature = read_number_field(parameters, "temperature", 0.8);
    let top_p = read_number_field(parameters, "topP", 0.95);
    let target_character_id = read_string_field(request, "targetCharacterId").trim();
    let target_character_name = read_string_field(request, "targetCharacterName").trim();
    if target_character_id.is_empty() {
        return Ok(serde_json::json!({
            "schemaVersion": 1,
            "requestId": request_id,
            "source": "provider-transport",
            "createdAt": read_string_field(request, "createdAt"),
            "messages": [],
            "warnings": ["No companion is available for this thread."]
        }));
    }

    let client = provider_http_client(PROVIDER_GENERATION_TIMEOUT)?;
    let headers = provider_headers(provider, &api_key)?;
    let (text, empty_warning) = if is_openai_compatible(provider) {
        let payload = post_provider_json(
            &client,
            append_openai_chat_completions_endpoint(base_url),
            headers,
            serde_json::json!({
                "model": model,
                "messages": prompt_messages,
                "temperature": temperature,
                "top_p": top_p,
                "max_tokens": max_tokens
            }),
            PROVIDER_GENERATION_TIMEOUT,
        )
        .await?;
        (
            extract_provider_text(provider, &payload),
            provider_empty_warning(provider, &payload),
        )
    } else if provider == "anthropic" {
        let payload = post_provider_json(
            &client,
            append_endpoint(base_url, "/messages"),
            headers,
            serde_json::json!({
                "model": model,
                "system": system_prompt(prompt_messages),
                "messages": non_system_messages(prompt_messages),
                "temperature": temperature,
                "top_p": top_p,
                "max_tokens": max_tokens
            }),
            PROVIDER_GENERATION_TIMEOUT,
        )
        .await?;
        (
            extract_provider_text(provider, &payload),
            provider_empty_warning(provider, &payload),
        )
    } else if provider == "google" {
        let normalized_model = model.trim_start_matches("models/");
        let payload = post_provider_json(
            &client,
            format!(
                "{}/models/{}:generateContent",
                base_url.trim_end_matches('/'),
                normalized_model
            ),
            headers,
            serde_json::json!({
                "systemInstruction": {
                    "parts": [{ "text": system_prompt(prompt_messages) }]
                },
                "contents": non_system_messages(prompt_messages)
                    .into_iter()
                    .map(|message| {
                        let role = if read_string_field(&message, "role") == "assistant" {
                            "model"
                        } else {
                            "user"
                        };
                        serde_json::json!({
                            "role": role,
                            "parts": [{ "text": read_string_field(&message, "content") }]
                        })
                    })
                    .collect::<Vec<serde_json::Value>>(),
                "generationConfig": {
                    "temperature": temperature,
                    "topP": top_p,
                    "maxOutputTokens": max_tokens
                }
            }),
            PROVIDER_GENERATION_TIMEOUT,
        )
        .await?;
        (
            extract_provider_text(provider, &payload),
            provider_empty_warning(provider, &payload),
        )
    } else {
        return Err(format!(
            "{provider} is not supported by the bare-minimum provider adapter yet."
        ));
    };

    let body = strip_speaker_prefix(text, target_character_name);
    if body.trim().is_empty() {
        return Ok(serde_json::json!({
            "schemaVersion": 1,
            "requestId": request_id,
            "source": "provider-transport",
            "createdAt": read_string_field(request, "createdAt"),
            "messages": [],
            "warnings": [empty_warning]
        }));
    }

    Ok(serde_json::json!({
        "schemaVersion": 1,
        "requestId": request_id,
        "source": "provider-transport",
        "createdAt": read_string_field(request, "createdAt"),
        "messages": [
            {
                "characterId": target_character_id,
                "body": body
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
pub(crate) async fn dekoi_runtime_invoke(
    app: tauri::AppHandle,
    command: String,
    args: Option<serde_json::Value>,
) -> Result<serde_json::Value, String> {
    let args = args.unwrap_or(serde_json::Value::Null);
    match command.as_str() {
        "generation_generate" => generation_generate(&args).await,
        "provider_connection_check" => provider_connection_check(&args).await,
        "provider_connection_models" => provider_connection_models(&args).await,
        "storage_create" => storage_create(&app, &args),
        "storage_delete" => storage_delete(&app, &args),
        "storage_list" => storage_list(&app, &args),
        "storage_replace" => storage_replace(&app, &args),
        "storage_update" => storage_update(&app, &args),
        _ => Err(format!(
            "Desktop runtime command is not supported: {command}"
        )),
    }
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
    fn provider_json_payload_rejects_empty_success_body() {
        let error = parse_provider_json_body(reqwest::StatusCode::OK, b"", "Model fetch")
            .expect_err("Empty successful provider bodies should not prove provider validity");

        assert_eq!(error, "Model fetch returned an empty response body.");
    }

    #[test]
    fn provider_json_payload_allows_empty_error_body_for_status_message() {
        let payload =
            parse_provider_json_body(reqwest::StatusCode::BAD_GATEWAY, b"", "Model fetch")
                .expect("Empty error bodies should still preserve HTTP status handling");

        assert_eq!(payload, serde_json::Value::Null);
    }

    #[test]
    fn provider_json_payload_rejects_malformed_success_body() {
        let error = parse_provider_json_body(reqwest::StatusCode::OK, b"not-json", "Model fetch")
            .expect_err("Non-empty malformed provider bodies should not be silently accepted");

        assert!(error.contains("invalid JSON response"));
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

    #[test]
    fn provider_connection_models_empty_payload_has_no_models() {
        let models = parse_provider_models(&serde_json::json!({
            "data": []
        }));

        assert!(models.is_empty());
    }

    #[test]
    fn provider_error_preserves_nested_error_detail() {
        let error = provider_error(
            &serde_json::json!({
                "error": {
                    "detail": "The selected model is not available for this key."
                }
            }),
            reqwest::StatusCode::BAD_REQUEST,
        );

        assert_eq!(
            error,
            "Provider returned HTTP 400 Bad Request: The selected model is not available for this key."
        );
    }

    #[test]
    fn provider_error_preserves_nested_error_code() {
        let error = provider_error(
            &serde_json::json!({
                "error": {
                    "code": "invalid_api_key"
                }
            }),
            reqwest::StatusCode::UNAUTHORIZED,
        );

        assert_eq!(
            error,
            "Provider returned HTTP 401 Unauthorized: invalid_api_key"
        );
    }
}
