use super::{
    auth::provider_connection_api_key,
    endpoints::{append_endpoint, append_openai_chat_completions_endpoint},
    http::{post_provider_json, provider_headers, provider_http_client},
    prompt::{non_system_messages, strip_speaker_prefix, system_prompt},
    value::{as_object, read_number_field, read_u64_field},
    PROVIDER_GENERATION_TIMEOUT,
};
use crate::provider_response::{
    extract_provider_text, is_openai_compatible, provider_empty_warning,
};
use crate::runtime_args::{read_string_field, runtime_args_object};

pub(crate) async fn generation_generate(
    args: &serde_json::Value,
) -> Result<serde_json::Value, String> {
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
