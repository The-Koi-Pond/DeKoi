pub(crate) fn is_openai_compatible(provider: &str) -> bool {
    matches!(
        provider,
        "openai" | "mistral" | "cohere" | "openrouter" | "nanogpt" | "xai" | "custom"
    )
}

pub(crate) fn extract_provider_text(provider: &str, payload: &serde_json::Value) -> String {
    if is_openai_compatible(provider) {
        return openai_text(payload);
    }

    if provider == "anthropic" {
        return generic_provider_text(payload);
    }

    if provider == "google" {
        return google_text(payload);
    }

    generic_provider_text(payload)
}

pub(crate) fn provider_empty_warning(provider: &str, payload: &serde_json::Value) -> String {
    if is_openai_compatible(provider) {
        let first_choice = payload
            .get("choices")
            .and_then(|choices| choices.as_array())
            .and_then(|choices| choices.first());
        let refusal = first_choice.map(first_refusal).unwrap_or_default();
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

fn first_refusal(value: &serde_json::Value) -> String {
    if let Some(items) = value.as_array() {
        for item in items {
            let refusal = first_refusal(item);
            if !refusal.is_empty() {
                return refusal;
            }
        }
        return String::new();
    }

    if let Some(record) = value.as_object() {
        if let Some(refusal) = record.get("refusal") {
            let text = if let Some(text) = refusal.as_str() {
                text.trim().to_string()
            } else {
                first_text(refusal).trim().to_string()
            };
            if !text.is_empty() {
                return text;
            }
        }

        for key in [
            "content", "parts", "message", "response", "output", "results", "data",
        ] {
            if let Some(field) = record.get(key) {
                let refusal = first_refusal(field);
                if !refusal.is_empty() {
                    return refusal;
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
                (!text.trim().is_empty()).then_some(text)
            })
        })
        .unwrap_or_default()
        .trim()
        .to_string()
}

fn google_text(payload: &serde_json::Value) -> String {
    if let Some(candidates) = payload
        .get("candidates")
        .and_then(|candidates| candidates.as_array())
    {
        return candidates
            .iter()
            .find_map(|candidate| {
                let text = first_text(candidate.get("content").unwrap_or(&serde_json::Value::Null));
                (!text.trim().is_empty()).then_some(text)
            })
            .unwrap_or_default()
            .trim()
            .to_string();
    }

    generic_provider_text(payload)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde::Deserialize;

    #[derive(Debug, Deserialize)]
    struct ProviderResponseParityFixtureFile {
        #[serde(rename = "schemaVersion")]
        schema_version: u8,
        cases: Vec<ProviderResponseParityFixture>,
    }

    #[derive(Debug, Deserialize)]
    struct ProviderResponseParityFixture {
        name: String,
        provider: String,
        payload: serde_json::Value,
        expected: ProviderResponseParityExpected,
    }

    #[derive(Debug, Deserialize)]
    struct ProviderResponseParityExpected {
        text: String,
        warning: Option<String>,
    }

    #[test]
    fn openai_empty_warning_preserves_content_part_refusal() {
        let warning = provider_empty_warning(
            "openai",
            &serde_json::json!({
                "choices": [
                    {
                        "message": {
                            "content": [
                                {
                                    "type": "refusal",
                                    "refusal": "Cannot help with that request."
                                }
                            ]
                        },
                        "finish_reason": "stop"
                    }
                ]
            }),
        );

        assert_eq!(
            warning,
            "Provider refused the reply: Cannot help with that request."
        );
    }

    #[test]
    fn provider_response_parity_fixtures_match_rust_extraction() {
        let fixtures: ProviderResponseParityFixtureFile =
            serde_json::from_str(include_str!(concat!(
                env!("CARGO_MANIFEST_DIR"),
                "/../test-fixtures/provider-response-parity.json"
            )))
            .expect("provider response parity fixtures should parse");

        assert_eq!(fixtures.schema_version, 1);

        for fixture in fixtures.cases {
            let text = extract_provider_text(&fixture.provider, &fixture.payload);
            let warning = if text.trim().is_empty() {
                Some(provider_empty_warning(&fixture.provider, &fixture.payload))
            } else {
                None
            };

            assert_eq!(text, fixture.expected.text, "{}", fixture.name);
            assert_eq!(warning, fixture.expected.warning, "{}", fixture.name);
        }
    }
}
