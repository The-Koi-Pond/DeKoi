use crate::storage::{
    read_string_field, runtime_args_object, storage_create, storage_delete, storage_list,
    storage_replace, storage_update,
};

const DESKTOP_RUNTIME_MARKER: &str = "de-koi-desktop";

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

fn response_shape(value: &serde_json::Value) -> String {
    if let Some(items) = value.as_array() {
        return format!("array({})", items.len());
    }

    if let Some(record) = value.as_object() {
        if record.is_empty() {
            return "object(no fields)".to_string();
        }

        let keys = record.keys().take(8).cloned().collect::<Vec<String>>();
        let suffix = if record.len() > 8 { ", ..." } else { "" };
        return format!("fields: {}{suffix}", keys.join(", "));
    }

    match value {
        serde_json::Value::Null => "null".to_string(),
        serde_json::Value::Bool(_) => "boolean".to_string(),
        serde_json::Value::Number(_) => "number".to_string(),
        serde_json::Value::String(_) => "string".to_string(),
        serde_json::Value::Array(_) | serde_json::Value::Object(_) => "unknown".to_string(),
    }
}

fn first_text(value: &serde_json::Value) -> String {
    if let Some(text) = value.as_str() {
        return text.to_string();
    }

    if let Some(items) = value.as_array() {
        return items
            .iter()
            .map(first_text)
            .filter(|text| !text.trim().is_empty())
            .collect::<Vec<String>>()
            .join("\n");
    }

    if let Some(record) = value.as_object() {
        for key in [
            "text",
            "output_text",
            "response_text",
            "generated_text",
            "content",
            "parts",
            "message",
            "response",
            "generation",
            "completion",
            "result",
            "results",
            "value",
        ] {
            if let Some(field) = record.get(key) {
                let text = first_text(field);
                if !text.trim().is_empty() {
                    return text;
                }
            }
        }
    }

    String::new()
}

fn generic_provider_text(payload: &serde_json::Value) -> String {
    if let Some(record) = payload.as_object() {
        for key in [
            "message",
            "response",
            "response_text",
            "output_text",
            "output",
            "generated_text",
            "generation",
            "completion",
            "result",
            "results",
            "content",
            "text",
            "data",
        ] {
            if let Some(field) = record.get(key) {
                let text = first_text(field);
                if !text.trim().is_empty() {
                    return text.trim().to_string();
                }
            }
        }
    }

    first_text(payload).trim().to_string()
}

fn empty_provider_warning(payload: &serde_json::Value) -> String {
    format!("Provider returned no text ({}).", response_shape(payload))
}

fn openai_text(payload: &serde_json::Value) -> String {
    let response_text = generic_provider_text(payload);
    if !response_text.trim().is_empty() {
        return response_text.trim().to_string();
    }

    payload
        .get("choices")
        .and_then(|choices| choices.as_array())
        .and_then(|choices| {
            choices.iter().find_map(|choice| {
                let text = choice
                    .get("message")
                    .and_then(|message| message.get("content"))
                    .map(first_text)
                    .filter(|text| !text.trim().is_empty())
                    .unwrap_or_else(|| {
                        first_text(choice.get("text").unwrap_or(&serde_json::Value::Null))
                    });
                (!text.trim().is_empty()).then(|| text)
            })
        })
        .unwrap_or_default()
        .trim()
        .to_string()
}

fn provider_empty_warning(provider: &str, payload: &serde_json::Value) -> String {
    if is_openai_compatible(provider) {
        let first_choice = payload
            .get("choices")
            .and_then(|choices| choices.as_array())
            .and_then(|choices| choices.first());
        let refusal = first_choice
            .and_then(|choice| choice.get("message"))
            .and_then(|message| message.get("refusal"))
            .and_then(|refusal| refusal.as_str())
            .unwrap_or("")
            .trim();
        if !refusal.is_empty() {
            return format!("Provider refused the reply: {refusal}");
        }

        let finish_reason = first_choice
            .and_then(|choice| choice.get("finish_reason"))
            .and_then(|reason| reason.as_str())
            .unwrap_or("")
            .trim();
        if !finish_reason.is_empty() {
            return format!("Provider returned no text (finish reason: {finish_reason}).");
        }
    }

    if provider == "anthropic" {
        let stop_reason = payload
            .get("stop_reason")
            .and_then(|reason| reason.as_str())
            .unwrap_or("")
            .trim();
        if !stop_reason.is_empty() {
            return format!("Provider returned no text (stop reason: {stop_reason}).");
        }
    }

    if provider == "google" {
        let block_reason = payload
            .get("promptFeedback")
            .and_then(|feedback| feedback.get("blockReason"))
            .and_then(|reason| reason.as_str())
            .unwrap_or("")
            .trim();
        if !block_reason.is_empty() {
            return format!("Provider blocked the prompt ({block_reason}).");
        }

        let finish_reason = payload
            .get("candidates")
            .and_then(|candidates| candidates.as_array())
            .and_then(|candidates| candidates.first())
            .and_then(|candidate| candidate.get("finishReason"))
            .and_then(|reason| reason.as_str())
            .unwrap_or("")
            .trim();
        if !finish_reason.is_empty() {
            return format!("Provider returned no text (finish reason: {finish_reason}).");
        }
    }

    empty_provider_warning(payload)
}

fn google_text(payload: &serde_json::Value) -> String {
    payload
        .get("candidates")
        .and_then(|candidates| candidates.as_array())
        .and_then(|candidates| {
            candidates.iter().find_map(|candidate| {
                let text = first_text(candidate.get("content").unwrap_or(&serde_json::Value::Null));
                (!text.trim().is_empty()).then(|| text)
            })
        })
        .unwrap_or_default()
        .trim()
        .to_string()
}

fn anthropic_text(payload: &serde_json::Value) -> String {
    generic_provider_text(payload)
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
    payload
        .get("error")
        .and_then(|error| error.get("message"))
        .and_then(|message| message.as_str())
        .or_else(|| payload.get("message").and_then(|message| message.as_str()))
        .or_else(|| payload.get("error").and_then(|error| error.as_str()))
        .map(ToString::to_string)
        .unwrap_or_else(|| format!("Provider returned HTTP {status}."))
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
    let api_key = connection
        .get("apiKey")
        .and_then(|value| value.as_str())
        .unwrap_or("");
    let request = provider_connection_check_request(provider, base_url, model)?;
    let client = reqwest::Client::new();
    let headers = provider_headers(provider, api_key)?;
    post_provider_json(&client, request.url, headers, request.body).await?;

    Ok(serde_json::json!({
        "success": true,
        "message": "API key is valid and the selected model can generate."
    }))
}
async fn post_provider_json(
    client: &reqwest::Client,
    url: String,
    headers: reqwest::header::HeaderMap,
    body: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let response = client
        .post(url)
        .headers(headers)
        .json(&body)
        .send()
        .await
        .map_err(|error| format!("Provider request failed. {error}"))?;
    let status = response.status();
    let payload = response
        .json::<serde_json::Value>()
        .await
        .unwrap_or(serde_json::Value::Null);
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

fn is_openai_compatible(provider: &str) -> bool {
    matches!(
        provider,
        "openai" | "mistral" | "cohere" | "openrouter" | "nanogpt" | "xai" | "custom"
    )
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
    let api_key = provider_connection
        .get("apiKey")
        .and_then(|value| value.as_str())
        .unwrap_or("");
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
            "providerKind": "external-provider",
            "createdAt": read_string_field(request, "createdAt"),
            "messages": [],
            "warnings": ["No companion is available for this thread."]
        }));
    }

    let client = reqwest::Client::new();
    let headers = provider_headers(provider, api_key)?;
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
        )
        .await?;
        (
            openai_text(&payload),
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
        )
        .await?;
        (
            anthropic_text(&payload),
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
        )
        .await?;
        (
            google_text(&payload),
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
            "providerKind": "external-provider",
            "createdAt": read_string_field(request, "createdAt"),
            "messages": [],
            "warnings": [empty_warning]
        }));
    }

    Ok(serde_json::json!({
        "schemaVersion": 1,
        "requestId": request_id,
        "providerKind": "external-provider",
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
}
