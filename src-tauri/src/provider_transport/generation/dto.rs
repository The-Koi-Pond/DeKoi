use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

use super::custom_parameters::validate_custom_parameters;
use crate::runtime_args::runtime_args_object;

#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
pub(super) enum GenerationProvider {
    Openai,
    OpenaiChatgpt,
    Anthropic,
    ClaudeSubscription,
    Google,
    GoogleVertex,
    Mistral,
    Cohere,
    Openrouter,
    Nanogpt,
    Xai,
    Custom,
}

impl GenerationProvider {
    pub(super) fn as_str(self) -> &'static str {
        match self {
            Self::Openai => "openai",
            Self::OpenaiChatgpt => "openai_chatgpt",
            Self::Anthropic => "anthropic",
            Self::ClaudeSubscription => "claude_subscription",
            Self::Google => "google",
            Self::GoogleVertex => "google_vertex",
            Self::Mistral => "mistral",
            Self::Cohere => "cohere",
            Self::Openrouter => "openrouter",
            Self::Nanogpt => "nanogpt",
            Self::Xai => "xai",
            Self::Custom => "custom",
        }
    }
}

#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub(super) enum GenerationConnectionStatus {
    Ready,
    NeedsKey,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct GenerationConnectionDto {
    pub(super) id: String,
    pub(super) provider: GenerationProvider,
    pub(super) base_url: String,
    pub(super) model: String,
    pub(super) status: GenerationConnectionStatus,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub(super) enum GenerationPromptRole {
    System,
    User,
    Assistant,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub(super) struct GenerationPromptMessageDto {
    pub(super) role: GenerationPromptRole,
    pub(super) content: String,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub(super) enum ReasoningEffort {
    None,
    Minimal,
    Low,
    Medium,
    High,
    Xhigh,
    Max,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub(super) enum GenerationVerbosity {
    Low,
    Medium,
    High,
    Xhigh,
    Max,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub(super) enum GenerationServiceTier {
    Auto,
    Default,
    Flex,
    Scale,
    Priority,
    StandardOnly,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct GenerationParametersDto {
    pub(super) max_tokens: Option<u32>,
    pub(super) temperature: Option<serde_json::Number>,
    pub(super) top_p: Option<serde_json::Number>,
    pub(super) top_k: Option<u32>,
    pub(super) min_p: Option<serde_json::Number>,
    pub(super) frequency_penalty: Option<serde_json::Number>,
    pub(super) presence_penalty: Option<serde_json::Number>,
    pub(super) reasoning_effort: Option<ReasoningEffort>,
    pub(super) verbosity: Option<GenerationVerbosity>,
    pub(super) service_tier: Option<GenerationServiceTier>,
    pub(super) stop_sequences: Option<Vec<String>>,
    pub(super) custom_parameters: Option<Map<String, Value>>,
}

#[derive(Debug)]
pub(super) struct RequiredNullableString(pub(super) Option<String>);

impl<'de> Deserialize<'de> for RequiredNullableString {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        Option::<String>::deserialize(deserializer).map(Self)
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct GenerationRequestDto {
    pub(super) id: String,
    pub(super) created_at: String,
    pub(super) target_character_id: RequiredNullableString,
    pub(super) target_character_name: RequiredNullableString,
    pub(super) connection: GenerationConnectionDto,
    pub(super) prompt_messages: Vec<GenerationPromptMessageDto>,
    pub(super) parameters: GenerationParametersDto,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct GenerationCommandArgsDto {
    request: GenerationRequestDto,
}

pub(super) fn validate_generation_args(args: &Value) -> Result<GenerationRequestDto, String> {
    let args = runtime_args_object(args, "generation_generate")?;
    let request_fields = args
        .get("request")
        .and_then(Value::as_object)
        .ok_or_else(|| "generation_generate request has an invalid shape.".to_string())?;
    if [
        "id",
        "createdAt",
        "targetCharacterId",
        "targetCharacterName",
        "connection",
        "promptMessages",
        "parameters",
    ]
    .iter()
    .any(|field| !request_fields.contains_key(*field))
    {
        return Err("generation_generate request has an invalid shape.".to_string());
    }
    let dto = serde_json::from_value::<GenerationCommandArgsDto>(Value::Object(args.clone()))
        .map_err(|_| "generation_generate request has an invalid shape.".to_string())?;
    let request = &dto.request;
    let connection = &request.connection;
    if request.id.trim().is_empty()
        || request.created_at.trim().is_empty()
        || connection.id.trim().is_empty()
        || connection.base_url.trim().is_empty()
        || connection.model.trim().is_empty()
        || request
            .target_character_id
            .0
            .as_ref()
            .is_some_and(|value| value.trim().is_empty())
        || request
            .target_character_name
            .0
            .as_ref()
            .is_some_and(|value| value.trim().is_empty())
        || request.prompt_messages.is_empty()
        || request
            .prompt_messages
            .iter()
            .any(|message| message.content.trim().is_empty())
    {
        return Err("generation_generate request has invalid required fields.".to_string());
    }

    let parameters = &request.parameters;
    let numeric_parameters_valid = parameters
        .max_tokens
        .is_none_or(|value| (1..=131_072).contains(&value))
        && parameters.temperature.as_ref().is_none_or(|value| {
            value
                .as_f64()
                .is_some_and(|value| (0.0..=2.0).contains(&value))
        })
        && parameters.top_p.as_ref().is_none_or(|value| {
            value
                .as_f64()
                .is_some_and(|value| (0.0..=1.0).contains(&value))
        })
        && parameters.top_k.is_none_or(|value| value <= 1_000)
        && parameters.min_p.as_ref().is_none_or(|value| {
            value
                .as_f64()
                .is_some_and(|value| (0.0..=1.0).contains(&value))
        })
        && parameters.frequency_penalty.as_ref().is_none_or(|value| {
            value
                .as_f64()
                .is_some_and(|value| (-2.0..=2.0).contains(&value))
        })
        && parameters.presence_penalty.as_ref().is_none_or(|value| {
            value
                .as_f64()
                .is_some_and(|value| (-2.0..=2.0).contains(&value))
        });
    let stop_sequences_valid = parameters.stop_sequences.as_ref().is_none_or(|stops| {
        stops
            .iter()
            .all(|stop| !stop.trim().is_empty() && stop.trim() == stop)
    });
    if !numeric_parameters_valid || !stop_sequences_valid {
        return Err("Generation parameters are invalid.".to_string());
    }
    if let Some(custom) = &parameters.custom_parameters {
        validate_custom_parameters(custom)?;
    }
    Ok(dto.request)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn valid_generation_args() -> Value {
        serde_json::json!({
            "request": {
                "id": "request-1",
                "createdAt": "2026-07-15T00:00:00.000Z",
                "targetCharacterId": "character-1",
                "targetCharacterName": "Koi",
                "connection": {
                    "id": "connection-1",
                    "provider": "custom",
                    "baseUrl": "https://provider.test/v1",
                    "model": "test-model",
                    "status": "ready"
                },
                "promptMessages": [{ "role": "user", "content": "Hello" }],
                "parameters": {}
            }
        })
    }

    #[test]
    fn rejects_unknown_or_private_fields_and_inline_secrets() {
        for (name, path, field) in [
            ("outer field", "outer", "warnings"),
            ("thread field", "request", "thread"),
            ("companions field", "request", "companions"),
            ("catalog field", "request", "lorebooks"),
            ("materialized payload", "request", "providerPayload"),
            ("arbitrary headers", "connection", "headers"),
            ("inline secret", "connection", "apiKey"),
        ] {
            let mut args = valid_generation_args();
            let target = match path {
                "outer" => args.as_object_mut().expect(name),
                "request" => args["request"].as_object_mut().expect(name),
                "connection" => args["request"]["connection"].as_object_mut().expect(name),
                _ => unreachable!(),
            };
            target.insert(
                field.to_string(),
                Value::String("sensitive-value".to_string()),
            );

            let error = validate_generation_args(&args).expect_err(name);
            assert!(error.contains("invalid shape"), "{name}: {error}");
            assert!(!error.contains("sensitive-value"), "{name}: {error}");
        }
    }

    #[test]
    fn rejects_missing_or_malformed_required_shapes() {
        let mut cases = Vec::new();
        let mut missing_parameters = valid_generation_args();
        missing_parameters["request"]
            .as_object_mut()
            .expect("request")
            .remove("parameters");
        cases.push(("missing parameters", missing_parameters));
        let mut null_parameters = valid_generation_args();
        null_parameters["request"]["parameters"] = Value::Null;
        cases.push(("null parameters", null_parameters));
        let mut missing_target = valid_generation_args();
        missing_target["request"]
            .as_object_mut()
            .expect("request")
            .remove("targetCharacterId");
        cases.push(("missing target identity", missing_target));
        let mut bad_role = valid_generation_args();
        bad_role["request"]["promptMessages"][0]["role"] = serde_json::json!("tool");
        cases.push(("bad prompt role", bad_role));
        let mut bad_content = valid_generation_args();
        bad_content["request"]["promptMessages"][0]["content"] = serde_json::json!(42);
        cases.push(("bad prompt content", bad_content));
        let mut extra_message_field = valid_generation_args();
        extra_message_field["request"]["promptMessages"][0]
            .as_object_mut()
            .expect("message")
            .insert("name".to_string(), serde_json::json!("private"));
        cases.push(("extra prompt field", extra_message_field));

        for (name, args) in cases {
            assert!(validate_generation_args(&args).is_err(), "{name}");
        }
    }

    #[test]
    fn rejects_wrong_types_invalid_enums_and_numeric_ranges() {
        let invalid_parameters = [
            (
                "wrong numeric type",
                "temperature",
                serde_json::json!("hot"),
            ),
            ("maxTokens below range", "maxTokens", serde_json::json!(0)),
            (
                "maxTokens above range",
                "maxTokens",
                serde_json::json!(131_073),
            ),
            (
                "temperature above range",
                "temperature",
                serde_json::json!(2.1),
            ),
            ("topP below range", "topP", serde_json::json!(-0.1)),
            ("topK above range", "topK", serde_json::json!(1_001)),
            ("minP above range", "minP", serde_json::json!(1.1)),
            (
                "frequency penalty below range",
                "frequencyPenalty",
                serde_json::json!(-2.1),
            ),
            (
                "presence penalty above range",
                "presencePenalty",
                serde_json::json!(2.1),
            ),
            (
                "invalid reasoning enum",
                "reasoningEffort",
                serde_json::json!("maximum"),
            ),
            (
                "invalid verbosity enum",
                "verbosity",
                serde_json::json!("verbose"),
            ),
            (
                "invalid service tier",
                "serviceTier",
                serde_json::json!("premium"),
            ),
            ("unknown parameter", "unknown", serde_json::json!(true)),
        ];

        for (name, field, value) in invalid_parameters {
            let mut args = valid_generation_args();
            args["request"]["parameters"]
                .as_object_mut()
                .expect(name)
                .insert(field.to_string(), value);
            assert!(validate_generation_args(&args).is_err(), "{name}");
        }
    }

    #[test]
    fn rejects_invalid_stop_sequences() {
        for (name, stops) in [
            ("non-array", serde_json::json!("END")),
            ("non-string", serde_json::json!(["END", 2])),
            ("empty", serde_json::json!([""])),
            ("untrimmed", serde_json::json!([" END "])),
        ] {
            let mut args = valid_generation_args();
            args["request"]["parameters"]["stopSequences"] = stops;
            assert!(validate_generation_args(&args).is_err(), "{name}");
        }
    }
}
