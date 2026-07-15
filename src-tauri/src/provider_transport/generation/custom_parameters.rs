use serde_json::{Map, Value};

fn protected_custom_parameter_name(name: &str) -> bool {
    let normalized = name.trim().to_ascii_lowercase();
    matches!(
        normalized.as_str(),
        "" | "__proto__" | "constructor" | "prototype"
    ) || PROTECTED_CUSTOM_PARAMETER_NAMES.contains(&normalized.as_str())
}

const PROTECTED_CUSTOM_PARAMETER_NAMES: &[&str] = &[
    "accept",
    "access_token",
    "accesstoken",
    "activepersona",
    "anthropic-version",
    "api_key",
    "apikey",
    "auth",
    "authentication",
    "authorization",
    "base_url",
    "baseurl",
    "basic",
    "bearer",
    "companions",
    "content-type",
    "contents",
    "cookie",
    "createdat",
    "customparameters",
    "endpoint",
    "frequency_penalty",
    "frequencypenalty",
    "generationconfig",
    "headers",
    "host",
    "id",
    "input",
    "lorebooks",
    "max_completion_tokens",
    "max_tokens",
    "maxoutputtokens",
    "maxtokens",
    "message",
    "messages",
    "min_p",
    "minp",
    "model",
    "models",
    "organization",
    "output_config",
    "parameters",
    "presence_penalty",
    "presencepenalty",
    "project",
    "prompt",
    "prompt_messages",
    "promptmessages",
    "provider",
    "provider_connection_id",
    "provider_routing",
    "providerconnection",
    "providerconnectionid",
    "reasoning_effort",
    "reasoningeffort",
    "request_id",
    "requestid",
    "response_format",
    "responseformat",
    "route",
    "routing",
    "schema_version",
    "schemaversion",
    "service_tier",
    "servicetier",
    "set-cookie",
    "source",
    "stop",
    "stop_sequences",
    "stopsequences",
    "stream",
    "system",
    "system_instruction",
    "systeminstruction",
    "target_character_id",
    "target_character_name",
    "targetcharacterid",
    "targetcharactername",
    "temperature",
    "thinking",
    "thinkingconfig",
    "thread",
    "token",
    "tool_choice",
    "toolchoice",
    "tools",
    "top_k",
    "top_p",
    "topk",
    "topp",
    "url",
    "user-agent",
    "verbosity",
    "warnings",
    "x-api-key",
    "x-goog-api-key",
];

fn custom_value_within_limits(value: &Value, depth: usize, entries: &mut usize) -> bool {
    if depth > 16 || *entries > 1_024 {
        return false;
    }
    match value {
        Value::Array(values) => {
            *entries += values.len();
            *entries <= 1_024
                && values
                    .iter()
                    .all(|value| custom_value_within_limits(value, depth + 1, entries))
        }
        Value::Object(fields) => {
            *entries += fields.len();
            *entries <= 1_024
                && fields.iter().all(|(name, value)| {
                    !matches!(
                        name.to_ascii_lowercase().as_str(),
                        "__proto__" | "constructor" | "prototype"
                    ) && name.len() <= 128
                        && custom_value_within_limits(value, depth + 1, entries)
                })
        }
        _ => true,
    }
}

pub(super) fn validate_custom_parameters(custom: &Map<String, Value>) -> Result<(), String> {
    for name in custom.keys() {
        if protected_custom_parameter_name(name) || name.len() > 128 {
            return Err(format!("Custom parameter name is reserved: {name}."));
        }
    }
    let aggregate = Value::Object(custom.clone());
    let mut entries = 0;
    let serialized_size = serde_json::to_vec(&aggregate)
        .map(|value| value.len())
        .unwrap_or(usize::MAX);
    if serialized_size > 65_536 || !custom_value_within_limits(&aggregate, 0, &mut entries) {
        return Err("Custom parameters exceed safety limits.".to_string());
    }
    Ok(())
}

pub(super) fn merge_custom_parameters(
    payload: &mut Map<String, Value>,
    custom: Option<&Map<String, Value>>,
) -> Result<(), String> {
    let Some(custom) = custom else {
        return Ok(());
    };
    validate_custom_parameters(custom)?;
    for (name, value) in custom {
        if payload.contains_key(name) {
            return Err(format!("Custom parameter name is reserved: {name}."));
        }
        payload.insert(name.clone(), value.clone());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn matches_the_canonical_protected_name_roster_exactly() {
        let fixture: Vec<String> = serde_json::from_str(include_str!(
            "../../../../test-fixtures/protected-custom-parameter-names.json"
        ))
        .expect("protected-name fixture should be valid JSON");
        let implementation: Vec<&str> = PROTECTED_CUSTOM_PARAMETER_NAMES.to_vec();
        assert_eq!(implementation, fixture);
    }

    #[test]
    fn rejects_reserved_custom_parameter_names_without_echoing_values() {
        for name in [
            "organization",
            "project",
            "stream",
            "tools",
            " ToolChoice ",
            "tool_choice",
            "responseFormat",
            "response_format",
            "targetCharacterId",
            "target_character_name",
            "thread",
            "companions",
            "activePersona",
            "lorebooks",
            "warnings",
            "provider_connection_id",
            "prompt_messages",
            "request_id",
            "schema_version",
            "base_url",
        ] {
            let custom = serde_json::json!({ name: "blocked" });
            let error =
                validate_custom_parameters(custom.as_object().expect(name)).expect_err(name);
            assert!(error.contains("reserved"), "{name}: {error}");
            assert!(!error.contains("blocked"), "{name}: {error}");
        }
    }

    #[test]
    fn enforces_aggregate_custom_limits_with_utf8_bytes() {
        let mut too_many = Map::new();
        for index in 0..600 {
            too_many.insert(
                format!("field_{index}"),
                serde_json::json!({ "nested": false }),
            );
        }
        let mut long_name = Map::new();
        long_name.insert("x".repeat(129), Value::Bool(false));
        let cases = [
            ("aggregate entries", too_many),
            ("long name", long_name),
            (
                "utf8 bytes",
                serde_json::json!({ "unicode": "鯉".repeat(22_000) })
                    .as_object()
                    .expect("object")
                    .clone(),
            ),
        ];
        for (name, custom) in cases {
            let error = validate_custom_parameters(&custom).expect_err(name);
            assert!(!error.contains('鯉'), "{name}: {error}");
        }

        let valid_unicode = serde_json::json!({ "unicode": "鯉" });
        validate_custom_parameters(valid_unicode.as_object().expect("object"))
            .expect("small non-ASCII JSON should remain valid");
    }
}
