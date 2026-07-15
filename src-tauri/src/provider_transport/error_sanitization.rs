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

fn protected_credential_field(name: &str) -> bool {
    matches!(
        name,
        "apikey"
            | "api_key"
            | "api-key"
            | "x-api-key"
            | "x_api_key"
            | "x-goog-api-key"
            | "x_goog_api_key"
            | "accesstoken"
            | "access_token"
            | "access-token"
            | "authorization"
            | "token"
    )
}

fn next_char_boundary(input: &str, index: usize) -> usize {
    index + input[index..].chars().next().map_or(1, char::len_utf8)
}

fn redact_credential_fields(input: &str) -> String {
    let lowercase = input.to_ascii_lowercase();
    let bytes = lowercase.as_bytes();
    let mut result = String::with_capacity(input.len());
    let mut copied_through = 0;
    let mut search = 0;

    while search < bytes.len() {
        if !input.is_char_boundary(search) {
            search += 1;
            continue;
        }
        let previous_is_name = lowercase[..search]
            .chars()
            .next_back()
            .is_some_and(|character| {
                character.is_ascii_alphanumeric() || matches!(character, '_' | '-')
            });
        if previous_is_name {
            search = next_char_boundary(input, search);
            continue;
        }

        let mut position = search;
        let field_quote = match bytes[position] {
            b'\'' | b'"' => {
                let quote = bytes[position];
                position += 1;
                Some(quote)
            }
            _ => None,
        };
        let name_start = position;
        while position < bytes.len()
            && (bytes[position].is_ascii_alphanumeric() || matches!(bytes[position], b'_' | b'-'))
        {
            position += 1;
        }
        if position == name_start {
            search = next_char_boundary(input, search);
            continue;
        }
        let name = &lowercase[name_start..position];
        if let Some(quote) = field_quote {
            if bytes.get(position) != Some(&quote) {
                search += 1;
                continue;
            }
            position += 1;
        }
        if !protected_credential_field(name) {
            search = next_char_boundary(input, search);
            continue;
        }

        while position < bytes.len() && bytes[position].is_ascii_whitespace() {
            position += 1;
        }
        if !matches!(bytes.get(position), Some(b':') | Some(b'=')) {
            search += 1;
            continue;
        }
        position += 1;
        while position < bytes.len() && bytes[position].is_ascii_whitespace() {
            position += 1;
        }
        let value_start = position;
        if value_start >= bytes.len() {
            break;
        }

        let value_end = if matches!(bytes[value_start], b'\'' | b'"') {
            let quote = bytes[value_start];
            position += 1;
            let mut escaped = false;
            while position < bytes.len() {
                let current = bytes[position];
                position += 1;
                if escaped {
                    escaped = false;
                } else if current == b'\\' {
                    escaped = true;
                } else if current == quote {
                    break;
                }
            }
            position
        } else {
            if name == "authorization" {
                for scheme in ["bearer ", "basic "] {
                    if lowercase[value_start..].starts_with(scheme) {
                        position = value_start + scheme.len();
                        while position < bytes.len() && bytes[position].is_ascii_whitespace() {
                            position += 1;
                        }
                        break;
                    }
                }
            }
            while position < bytes.len()
                && !bytes[position].is_ascii_whitespace()
                && !matches!(bytes[position], b',' | b';' | b'}' | b']' | b')')
            {
                position += 1;
            }
            position
        };

        if value_end == value_start {
            search += 1;
            continue;
        }
        result.push_str(&input[copied_through..value_start]);
        result.push_str("[redacted]");
        copied_through = value_end;
        search = value_end;
    }

    result.push_str(&input[copied_through..]);
    result
}

pub(super) fn clean_provider_error_detail(detail: &str) -> String {
    let collapsed = detail.split_whitespace().collect::<Vec<_>>().join(" ");
    let mut cleaned = redact_credential_fields(&collapsed)
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
