use std::time::Duration;

pub(super) fn provider_http_client(timeout: Duration) -> Result<reqwest::Client, String> {
    reqwest::ClientBuilder::new()
        .timeout(timeout)
        .build()
        .map_err(|error| format!("Provider HTTP client failed to initialize. {error}"))
}

pub(super) fn provider_request_error(
    action: &str,
    timeout: Duration,
    error: reqwest::Error,
) -> String {
    if error.is_timeout() {
        format!("{action} timed out after {} seconds.", timeout.as_secs())
    } else {
        format!(
            "{action} failed. {}",
            clean_provider_error_detail(&error.to_string())
        )
    }
}

fn redact_marker_value(input: &str, marker: &str) -> String {
    let mut result = String::new();
    let mut remaining = input;
    loop {
        let lowercase = remaining.to_ascii_lowercase();
        let Some(start) = lowercase.find(marker) else {
            result.push_str(remaining);
            break;
        };
        let value_start = start + marker.len();
        let value_len = remaining[value_start..]
            .find(|character: char| character.is_whitespace() || matches!(character, ',' | ';'))
            .unwrap_or(remaining.len() - value_start);
        result.push_str(&remaining[..value_start]);
        result.push_str("[redacted]");
        remaining = &remaining[value_start + value_len..];
    }
    result
}

fn redact_url_userinfo(token: &str) -> String {
    let Some(scheme) = token.find("://") else {
        return token.to_string();
    };
    let authority_start = scheme + 3;
    let authority_end = token[authority_start..]
        .find('/')
        .map(|index| authority_start + index)
        .unwrap_or(token.len());
    let Some(at) = token[authority_start..authority_end].find('@') else {
        return token.to_string();
    };
    let at = authority_start + at;
    format!("{}[redacted]{}", &token[..authority_start], &token[at..])
}

fn clean_provider_error_detail(detail: &str) -> String {
    let collapsed = detail.split_whitespace().collect::<Vec<_>>().join(" ");
    let mut cleaned = collapsed
        .split(' ')
        .map(redact_url_userinfo)
        .collect::<Vec<_>>()
        .join(" ");
    for marker in [
        "bearer ",
        "basic ",
        "api_key=",
        "api_key:",
        "api-key=",
        "api-key:",
        "x-api-key=",
        "x-api-key:",
        "x-goog-api-key=",
        "x-goog-api-key:",
        "sk-",
        "aiza",
    ] {
        cleaned = redact_marker_value(&cleaned, marker);
    }
    let cleaned = cleaned.chars().take(300).collect::<String>();
    if cleaned.is_empty() {
        "Unknown provider error.".to_string()
    } else {
        cleaned
    }
}

pub(super) fn redact_provider_error_secret(detail: &str, api_key: &str) -> String {
    let key = api_key.trim();
    if key.is_empty() {
        return clean_provider_error_detail(detail);
    }
    clean_provider_error_detail(&detail.replace(key, "[redacted]"))
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

pub(super) async fn provider_json_payload(
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

pub(super) fn provider_error(payload: &serde_json::Value, status: reqwest::StatusCode) -> String {
    let message = provider_payload_error(payload).or_else(|| {
        payload
            .get("message")
            .and_then(|message| message.as_str())
            .map(ToString::to_string)
    });

    match message.map(|message| message.trim().to_string()) {
        Some(message) if !message.is_empty() => {
            format!(
                "Provider returned HTTP {status}: {}",
                clean_provider_error_detail(&message)
            )
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

pub(super) async fn post_provider_json(
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
        return Err(clean_provider_error_detail(&error));
    }

    Ok(payload)
}

pub(super) fn provider_headers(
    provider: &str,
    api_key: &str,
) -> Result<reqwest::header::HeaderMap, String> {
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

#[cfg(test)]
mod tests {
    use super::*;

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

    #[test]
    fn provider_error_redacts_credentials_and_caps_detail() {
        let error = provider_error(
            &serde_json::json!({
                "error": {
                    "message": format!(
                        "Authorization: Bearer secret-token https://user:password@provider.test api_key=sk-secret AIzaSyExampleGoogleKey123456789 {}",
                        "x".repeat(500)
                    )
                }
            }),
            reqwest::StatusCode::BAD_REQUEST,
        );

        assert!(!error.contains("secret-token"));
        assert!(!error.contains("password"));
        assert!(!error.contains("sk-secret"));
        assert!(!error.contains("AIzaSyExampleGoogleKey"));
        assert!(error.chars().count() <= 340);
    }

    #[test]
    fn provider_error_redacts_the_exact_in_memory_secret() {
        let error = redact_provider_error_secret(
            "Provider echoed totally-custom-secret in an error.",
            "totally-custom-secret",
        );

        assert_eq!(error, "Provider echoed [redacted] in an error.");
    }
}
