mod custom_parameters;
mod dto;
mod payload;

use serde_json::Value;

use self::{
    dto::{
        validate_generation_args, GenerationConnectionDto, GenerationConnectionStatus,
        GenerationProvider,
    },
    payload::build_provider_payload,
};
use super::{
    auth::provider_connection_api_key_for_scope,
    endpoints::{append_endpoint, append_openai_chat_completions_endpoint},
    http::{
        post_provider_json, provider_headers, provider_http_client, redact_provider_error_secret,
    },
    prompt::strip_speaker_prefix,
    PROVIDER_GENERATION_TIMEOUT,
};
use crate::provider_response::{
    extract_provider_text, is_openai_compatible, provider_empty_warning,
};

fn generation_api_key(connection: &GenerationConnectionDto) -> Result<String, String> {
    provider_connection_api_key_for_scope(
        connection.provider.as_str(),
        connection.id.trim(),
        connection.base_url.trim(),
        matches!(connection.status, GenerationConnectionStatus::Ready),
    )
}

fn generation_endpoint(
    provider: GenerationProvider,
    base_url: &str,
    model: &str,
) -> Result<String, String> {
    let provider_name = provider.as_str();
    if is_openai_compatible(provider_name) {
        Ok(append_openai_chat_completions_endpoint(base_url))
    } else if matches!(provider, GenerationProvider::Anthropic) {
        Ok(append_endpoint(base_url, "/messages"))
    } else if matches!(provider, GenerationProvider::Google) {
        Ok(format!(
            "{}/models/{}:generateContent",
            base_url.trim_end_matches('/'),
            model.trim_start_matches("models/")
        ))
    } else {
        Err(format!("{provider_name} is not supported for generation."))
    }
}

pub(crate) async fn generation_generate(args: &Value) -> Result<Value, String> {
    let request = validate_generation_args(args)?;
    let connection = &request.connection;
    let provider = connection.provider;
    let provider_name = provider.as_str();
    let base_url = connection.base_url.trim();
    let model = connection.model.trim();
    let provider_payload = build_provider_payload(
        provider,
        model,
        &request.prompt_messages,
        &request.parameters,
    )?;

    let request_id = request.id.trim();
    let target_character_id = request
        .target_character_id
        .0
        .as_deref()
        .map(str::trim)
        .unwrap_or("");
    let target_character_name = request
        .target_character_name
        .0
        .as_deref()
        .map(str::trim)
        .unwrap_or("");
    if target_character_id.is_empty() {
        return Ok(serde_json::json!({
            "schemaVersion": 1,
            "requestId": request_id,
            "source": "provider-transport",
            "createdAt": request.created_at,
            "messages": [],
            "warnings": ["No companion is available for this thread."]
        }));
    }

    let api_key = generation_api_key(connection)?;
    let client = provider_http_client(PROVIDER_GENERATION_TIMEOUT)?;
    let headers = provider_headers(provider_name, &api_key)?;
    let endpoint = generation_endpoint(provider, base_url, model)?;
    let response_payload = post_provider_json(
        &client,
        endpoint,
        headers,
        provider_payload,
        PROVIDER_GENERATION_TIMEOUT,
    )
    .await
    .map_err(|error| redact_provider_error_secret(&error, &api_key))?;
    let text = extract_provider_text(provider_name, &response_payload);
    let empty_warning = provider_empty_warning(provider_name, &response_payload);
    let body = strip_speaker_prefix(text, target_character_name);
    if body.trim().is_empty() {
        return Ok(serde_json::json!({
            "schemaVersion": 1,
            "requestId": request_id,
            "source": "provider-transport",
            "createdAt": request.created_at,
            "messages": [],
            "warnings": [empty_warning]
        }));
    }

    Ok(serde_json::json!({
        "schemaVersion": 1,
        "requestId": request_id,
        "source": "provider-transport",
        "createdAt": request.created_at,
        "messages": [{ "characterId": target_character_id, "body": body }],
        "warnings": []
    }))
}
