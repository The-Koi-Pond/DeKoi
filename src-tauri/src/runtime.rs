use crate::storage::{
    read_string_field, runtime_args_object, storage_create, storage_delete, storage_list,
    storage_update,
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

fn first_text(value: &serde_json::Value) -> String {
    if let Some(text) = value.as_str() {
        return text.to_string();
    }

    value
        .as_array()
        .map(|items| {
            items
                .iter()
                .filter_map(|item| {
                    item.as_str()
                        .map(ToString::to_string)
                        .or_else(|| item.get("text").and_then(|text| text.as_str()).map(ToString::to_string))
                })
                .collect::<Vec<String>>()
                .join("\n")
        })
        .unwrap_or_default()
}

fn openai_text(payload: &serde_json::Value) -> String {
    payload
        .get("choices")
        .and_then(|choices| choices.as_array())
        .and_then(|choices| choices.first())
        .map(|choice| {
            choice
                .get("message")
                .and_then(|message| message.get("content"))
                .map(first_text)
                .filter(|text| !text.trim().is_empty())
                .unwrap_or_else(|| first_text(choice.get("text").unwrap_or(&serde_json::Value::Null)))
        })
        .unwrap_or_default()
        .trim()
        .to_string()
}

fn anthropic_text(payload: &serde_json::Value) -> String {
    first_text(payload.get("content").unwrap_or(&serde_json::Value::Null))
        .trim()
        .to_string()
}

fn google_text(payload: &serde_json::Value) -> String {
    payload
        .get("candidates")
        .and_then(|candidates| candidates.as_array())
        .and_then(|candidates| candidates.first())
        .and_then(|candidate| candidate.get("content"))
        .and_then(|content| content.get("parts"))
        .and_then(|parts| parts.as_array())
        .map(|parts| {
            parts
                .iter()
                .filter_map(|part| part.get("text").and_then(|text| text.as_str()))
                .collect::<Vec<&str>>()
                .join("\n")
        })
        .unwrap_or_default()
        .trim()
        .to_string()
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
    if !speaker_name.trim().is_empty() && trimmed.to_lowercase().starts_with(&prefix.to_lowercase()) {
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
            reqwest::header::HeaderValue::from_str(key)
                .map_err(|error| format!("Provider API key is not a valid header value. {error}"))?,
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
            reqwest::header::HeaderValue::from_str(key)
                .map_err(|error| format!("Provider API key is not a valid header value. {error}"))?,
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

async fn messenger_generate(args: &serde_json::Value) -> Result<serde_json::Value, String> {
    let args = runtime_args_object(args, "messenger_generate")?;
    let request = args
        .get("request")
        .ok_or_else(|| "messenger_generate requires args.request.".to_string())?;
    let request_id = read_string_field(request, "id").trim();
    if request_id.is_empty() {
        return Err("messenger_generate request requires id.".to_string());
    }

    let provider_connection = request
        .get("providerConnection")
        .ok_or_else(|| "messenger_generate requires request.providerConnection.".to_string())?;
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
        .ok_or_else(|| "messenger_generate requires request.promptMessages.".to_string())?;
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
    let text = if is_openai_compatible(provider) {
        let payload = post_provider_json(
            &client,
            append_endpoint(base_url, "/chat/completions"),
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
        openai_text(&payload)
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
        anthropic_text(&payload)
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
        google_text(&payload)
    } else {
        return Err(format!(
            "{provider} is not supported by the bare-minimum Messenger provider adapter yet."
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
            "warnings": ["Provider did not return a usable companion reply."]
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
        "messenger_generate" => messenger_generate(&args).await,
        "storage_create" => storage_create(&app, &args),
        "storage_delete" => storage_delete(&app, &args),
        "storage_list" => storage_list(&app, &args),
        "storage_update" => storage_update(&app, &args),
        _ => Err(format!(
            "Desktop runtime command is not supported: {command}"
        )),
    }
}
