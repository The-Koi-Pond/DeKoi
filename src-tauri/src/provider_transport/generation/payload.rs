use serde::Serialize;
use serde_json::{Map, Value};

use super::{
    custom_parameters::merge_custom_parameters,
    dto::{
        GenerationParametersDto, GenerationPromptMessageDto, GenerationPromptRole,
        GenerationProvider, GenerationServiceTier, ReasoningEffort,
    },
};

fn insert_serialized<T: Serialize>(
    payload: &mut Map<String, Value>,
    name: &str,
    value: Option<&T>,
) {
    if let Some(value) = value {
        payload.insert(
            name.to_string(),
            serde_json::to_value(value).expect("validated generation DTO values must serialize"),
        );
    }
}

fn system_prompt(messages: &[GenerationPromptMessageDto]) -> String {
    messages
        .iter()
        .filter(|message| matches!(message.role, GenerationPromptRole::System))
        .map(|message| message.content.trim())
        .filter(|content| !content.is_empty())
        .collect::<Vec<_>>()
        .join("\n\n")
}

fn non_system_messages(messages: &[GenerationPromptMessageDto]) -> Value {
    Value::Array(
        messages
            .iter()
            .filter(|message| !matches!(message.role, GenerationPromptRole::System))
            .map(|message| {
                serde_json::to_value(message).expect("validated prompt message must serialize")
            })
            .collect(),
    )
}

fn base_oai_payload(model: &str, messages: &[GenerationPromptMessageDto]) -> Map<String, Value> {
    let mut payload = Map::new();
    payload.insert("model".to_string(), Value::String(model.to_string()));
    payload.insert(
        "messages".to_string(),
        serde_json::to_value(messages).expect("validated prompt messages must serialize"),
    );
    payload
}

fn assign_common_oai(payload: &mut Map<String, Value>, parameters: &GenerationParametersDto) {
    insert_serialized(payload, "temperature", parameters.temperature.as_ref());
    insert_serialized(payload, "top_p", parameters.top_p.as_ref());
    insert_serialized(
        payload,
        "frequency_penalty",
        parameters.frequency_penalty.as_ref(),
    );
    insert_serialized(
        payload,
        "presence_penalty",
        parameters.presence_penalty.as_ref(),
    );
    insert_serialized(payload, "stop", parameters.stop_sequences.as_ref());
}

fn conservative_oai_payload(
    model: &str,
    messages: &[GenerationPromptMessageDto],
    parameters: &GenerationParametersDto,
) -> Map<String, Value> {
    let mut payload = base_oai_payload(model, messages);
    insert_serialized(&mut payload, "max_tokens", parameters.max_tokens.as_ref());
    assign_common_oai(&mut payload, parameters);
    payload
}

fn validate_provider_payload_input(
    provider: GenerationProvider,
    messages: &[GenerationPromptMessageDto],
    parameters: &GenerationParametersDto,
) -> Result<(), String> {
    if !matches!(provider, GenerationProvider::Custom)
        && parameters
            .custom_parameters
            .as_ref()
            .is_some_and(|custom| !custom.is_empty())
    {
        return Err("Custom parameters are supported only by the custom provider.".to_string());
    }
    if matches!(
        provider,
        GenerationProvider::Anthropic | GenerationProvider::Google
    ) && !messages.iter().any(|message| {
        matches!(
            message.role,
            GenerationPromptRole::User | GenerationPromptRole::Assistant
        )
    }) {
        return Err(
            "Provider generation requires at least one user or assistant prompt message."
                .to_string(),
        );
    }
    Ok(())
}

// Provider wire boundaries verified 2026-07-15 against the OpenAI Chat,
// Anthropic Messages, Google generateContent, and OpenRouter parameter docs.
pub(super) fn build_provider_payload(
    provider: GenerationProvider,
    model: &str,
    messages: &[GenerationPromptMessageDto],
    parameters: &GenerationParametersDto,
) -> Result<Value, String> {
    validate_provider_payload_input(provider, messages, parameters)?;

    let payload = match provider {
        GenerationProvider::Openai => {
            let mut payload = base_oai_payload(model, messages);
            insert_serialized(
                &mut payload,
                "max_completion_tokens",
                parameters.max_tokens.as_ref(),
            );
            assign_common_oai(&mut payload, parameters);
            insert_serialized(
                &mut payload,
                "reasoning_effort",
                parameters.reasoning_effort.as_ref(),
            );
            if matches!(
                parameters.service_tier,
                Some(
                    GenerationServiceTier::Auto
                        | GenerationServiceTier::Default
                        | GenerationServiceTier::Flex
                        | GenerationServiceTier::Scale
                        | GenerationServiceTier::Priority
                )
            ) {
                insert_serialized(
                    &mut payload,
                    "service_tier",
                    parameters.service_tier.as_ref(),
                );
            }
            payload
        }
        GenerationProvider::Mistral
        | GenerationProvider::Cohere
        | GenerationProvider::Nanogpt
        | GenerationProvider::Xai => conservative_oai_payload(model, messages, parameters),
        GenerationProvider::Openrouter => {
            let mut payload = conservative_oai_payload(model, messages, parameters);
            insert_serialized(&mut payload, "top_k", parameters.top_k.as_ref());
            insert_serialized(&mut payload, "min_p", parameters.min_p.as_ref());
            insert_serialized(
                &mut payload,
                "reasoning_effort",
                parameters.reasoning_effort.as_ref(),
            );
            insert_serialized(&mut payload, "verbosity", parameters.verbosity.as_ref());
            payload
        }
        GenerationProvider::Anthropic => {
            if parameters.max_tokens.is_none() {
                return Err("Anthropic generation requires maxTokens.".to_string());
            }
            let mut payload = Map::new();
            payload.insert("model".to_string(), Value::String(model.to_string()));
            let system = system_prompt(messages);
            if !system.is_empty() {
                payload.insert("system".to_string(), Value::String(system));
            }
            payload.insert("messages".to_string(), non_system_messages(messages));
            insert_serialized(&mut payload, "max_tokens", parameters.max_tokens.as_ref());
            insert_serialized(&mut payload, "temperature", parameters.temperature.as_ref());
            insert_serialized(&mut payload, "top_p", parameters.top_p.as_ref());
            insert_serialized(&mut payload, "top_k", parameters.top_k.as_ref());
            insert_serialized(
                &mut payload,
                "stop_sequences",
                parameters.stop_sequences.as_ref(),
            );
            if matches!(
                parameters.reasoning_effort,
                Some(
                    ReasoningEffort::Low
                        | ReasoningEffort::Medium
                        | ReasoningEffort::High
                        | ReasoningEffort::Xhigh
                        | ReasoningEffort::Max
                )
            ) {
                payload.insert(
                    "output_config".to_string(),
                    serde_json::json!({ "effort": parameters.reasoning_effort }),
                );
            }
            if matches!(
                parameters.service_tier,
                Some(GenerationServiceTier::Auto | GenerationServiceTier::StandardOnly)
            ) {
                insert_serialized(
                    &mut payload,
                    "service_tier",
                    parameters.service_tier.as_ref(),
                );
            }
            payload
        }
        GenerationProvider::Google => {
            let system = system_prompt(messages);
            let mut payload = Map::new();
            if !system.is_empty() {
                payload.insert(
                    "systemInstruction".to_string(),
                    serde_json::json!({ "parts": [{ "text": system }] }),
                );
            }
            payload.insert(
                "contents".to_string(),
                Value::Array(
                    messages
                        .iter()
                        .filter(|message| !matches!(message.role, GenerationPromptRole::System))
                        .map(|message| {
                            let role = if matches!(message.role, GenerationPromptRole::Assistant) {
                                "model"
                            } else {
                                "user"
                            };
                            serde_json::json!({
                                "role": role,
                                "parts": [{ "text": message.content }]
                            })
                        })
                        .collect(),
                ),
            );
            let mut config = Map::new();
            insert_serialized(
                &mut config,
                "maxOutputTokens",
                parameters.max_tokens.as_ref(),
            );
            insert_serialized(&mut config, "temperature", parameters.temperature.as_ref());
            insert_serialized(&mut config, "topP", parameters.top_p.as_ref());
            insert_serialized(&mut config, "topK", parameters.top_k.as_ref());
            insert_serialized(
                &mut config,
                "frequencyPenalty",
                parameters.frequency_penalty.as_ref(),
            );
            insert_serialized(
                &mut config,
                "presencePenalty",
                parameters.presence_penalty.as_ref(),
            );
            if let Some(stops) = &parameters.stop_sequences {
                config.insert(
                    "stopSequences".to_string(),
                    serde_json::json!(stops.iter().take(5).collect::<Vec<_>>()),
                );
            }
            let thinking_level = match parameters.reasoning_effort {
                Some(ReasoningEffort::Minimal) => Some("MINIMAL"),
                Some(ReasoningEffort::Low) => Some("LOW"),
                Some(ReasoningEffort::Medium) => Some("MEDIUM"),
                Some(ReasoningEffort::High | ReasoningEffort::Xhigh | ReasoningEffort::Max) => {
                    Some("HIGH")
                }
                _ => None,
            };
            if let Some(thinking_level) = thinking_level {
                config.insert(
                    "thinkingConfig".to_string(),
                    serde_json::json!({ "thinkingLevel": thinking_level }),
                );
            }
            if !config.is_empty() {
                payload.insert("generationConfig".to_string(), Value::Object(config));
            }
            payload
        }
        GenerationProvider::Custom => {
            let mut payload = conservative_oai_payload(model, messages, parameters);
            insert_serialized(&mut payload, "top_k", parameters.top_k.as_ref());
            insert_serialized(&mut payload, "min_p", parameters.min_p.as_ref());
            insert_serialized(
                &mut payload,
                "reasoning_effort",
                parameters.reasoning_effort.as_ref(),
            );
            insert_serialized(&mut payload, "verbosity", parameters.verbosity.as_ref());
            insert_serialized(
                &mut payload,
                "service_tier",
                parameters.service_tier.as_ref(),
            );
            merge_custom_parameters(&mut payload, parameters.custom_parameters.as_ref())?;
            payload
        }
        GenerationProvider::OpenaiChatgpt
        | GenerationProvider::ClaudeSubscription
        | GenerationProvider::GoogleVertex => {
            return Err(format!(
                "{} is not supported for generation.",
                provider.as_str()
            ));
        }
    };

    Ok(Value::Object(payload))
}

#[cfg(test)]
mod tests {
    use serde::Deserialize;

    use super::*;

    #[derive(Debug, Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct ProviderPayloadFixture {
        name: String,
        provider: GenerationProvider,
        model: String,
        messages: Vec<GenerationPromptMessageDto>,
        parameters: GenerationParametersDto,
        expected: Option<Value>,
        expected_error: Option<String>,
    }

    #[derive(Debug, Deserialize)]
    struct ProviderPayloadFixtures {
        cases: Vec<ProviderPayloadFixture>,
    }

    #[test]
    fn provider_parameter_payloads_match_shared_fixtures() {
        let fixtures: ProviderPayloadFixtures = serde_json::from_str(include_str!(
            "../../../../test-fixtures/provider-parameter-payloads.json"
        ))
        .expect("shared parameter fixtures should match typed payload inputs");

        for fixture in fixtures.cases {
            let result = build_provider_payload(
                fixture.provider,
                &fixture.model,
                &fixture.messages,
                &fixture.parameters,
            );

            if let Some(expected_error) = fixture.expected_error {
                assert_eq!(
                    result.expect_err(&fixture.name),
                    expected_error,
                    "{}",
                    fixture.name
                );
            } else {
                assert_eq!(
                    result.expect(&fixture.name),
                    fixture
                        .expected
                        .expect("successful fixture must have expected payload"),
                    "{}",
                    fixture.name
                );
            }
        }
    }
}
