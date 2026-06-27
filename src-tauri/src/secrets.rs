const PROVIDER_SECRET_SERVICE: &str = "com.xelvanas.dekoi.provider-key";

#[derive(serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct ProviderSecretEnvelope {
    schema_version: u8,
    provider: String,
    base_url: String,
    secret: String,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProviderSecretStatus {
    connection_id: String,
    has_secret: bool,
}

fn provider_secret_username(connection_id: &str) -> Result<String, String> {
    let trimmed = connection_id.trim();
    if trimmed.is_empty() {
        return Err("Provider connection id is required.".to_string());
    }

    Ok(format!("provider:{trimmed}"))
}

fn provider_secret_entry(connection_id: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new(
        PROVIDER_SECRET_SERVICE,
        provider_secret_username(connection_id)?.as_str(),
    )
    .map_err(|error| format!("Could not open provider key store. {error}"))
}

fn provider_secret_status_for(connection_id: String) -> Result<ProviderSecretStatus, String> {
    let entry = provider_secret_entry(&connection_id)?;
    match entry.get_password() {
        Ok(_) => Ok(ProviderSecretStatus {
            connection_id,
            has_secret: true,
        }),
        Err(keyring::Error::NoEntry) => Ok(ProviderSecretStatus {
            connection_id,
            has_secret: false,
        }),
        Err(error) => Err(format!("Could not check provider key. {error}")),
    }
}

pub(crate) fn provider_secret_read(connection_id: &str) -> Result<Option<String>, String> {
    let entry = provider_secret_entry(connection_id)?;
    match entry.get_password() {
        Ok(secret) => Ok(Some(secret)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(format!("Could not read provider key. {error}")),
    }
}

fn normalize_provider_secret_base_url(base_url: &str) -> String {
    base_url.trim().trim_end_matches('/').to_string()
}

fn provider_secret_value_for_scope(
    stored_secret: &str,
    provider: &str,
    base_url: &str,
    allow_unscoped: bool,
) -> Option<String> {
    match serde_json::from_str::<ProviderSecretEnvelope>(stored_secret) {
        Ok(envelope)
            if envelope.provider.trim() == provider.trim()
                && normalize_provider_secret_base_url(&envelope.base_url)
                    == normalize_provider_secret_base_url(base_url)
                && !envelope.secret.trim().is_empty() =>
        {
            Some(envelope.secret)
        }
        Ok(_) => None,
        Err(_) if allow_unscoped && !stored_secret.trim().is_empty() => {
            Some(stored_secret.to_string())
        }
        Err(_) => None,
    }
}

pub(crate) fn provider_secret_read_for_scope(
    connection_id: &str,
    provider: &str,
    base_url: &str,
    allow_unscoped: bool,
) -> Result<Option<String>, String> {
    Ok(provider_secret_read(connection_id)?.and_then(|secret| {
        provider_secret_value_for_scope(&secret, provider, base_url, allow_unscoped)
    }))
}

pub(crate) fn provider_secret_store_is_available() -> bool {
    provider_secret_entry("host-status-probe").is_ok()
}

#[tauri::command]
pub(crate) fn dekoi_provider_secret_status(
    connection_id: String,
) -> Result<ProviderSecretStatus, String> {
    provider_secret_status_for(connection_id)
}

#[tauri::command]
pub(crate) fn dekoi_provider_secret_write(
    connection_id: String,
    secret: String,
    provider: Option<String>,
    base_url: Option<String>,
) -> Result<ProviderSecretStatus, String> {
    let trimmed_secret = secret.trim();
    if trimmed_secret.is_empty() {
        return Err("Provider key cannot be empty.".to_string());
    }

    let stored_secret = match (provider, base_url) {
        (Some(provider), Some(base_url)) if !provider.trim().is_empty() => {
            serde_json::to_string(&ProviderSecretEnvelope {
                schema_version: 1,
                provider: provider.trim().to_string(),
                base_url: normalize_provider_secret_base_url(&base_url),
                secret: trimmed_secret.to_string(),
            })
            .map_err(|error| format!("Could not prepare provider key. {error}"))?
        }
        _ => trimmed_secret.to_string(),
    };

    let entry = provider_secret_entry(&connection_id)?;
    entry
        .set_password(&stored_secret)
        .map_err(|error| format!("Could not save provider key. {error}"))?;

    Ok(ProviderSecretStatus {
        connection_id,
        has_secret: true,
    })
}

#[tauri::command]
pub(crate) fn dekoi_provider_secret_delete(
    connection_id: String,
) -> Result<ProviderSecretStatus, String> {
    let entry = provider_secret_entry(&connection_id)?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(ProviderSecretStatus {
            connection_id,
            has_secret: false,
        }),
        Err(error) => Err(format!("Could not clear provider key. {error}")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scoped_secret_matches_provider_and_base_url() {
        let stored_secret = serde_json::to_string(&ProviderSecretEnvelope {
            schema_version: 1,
            provider: "custom".to_string(),
            base_url: "https://example.test/v1".to_string(),
            secret: "saved-key".to_string(),
        })
        .expect("secret envelope should serialize");

        assert_eq!(
            provider_secret_value_for_scope(
                &stored_secret,
                "custom",
                "https://example.test/v1/",
                false,
            ),
            Some("saved-key".to_string()),
        );
    }

    #[test]
    fn scoped_secret_rejects_provider_or_base_url_mismatch() {
        let stored_secret = serde_json::to_string(&ProviderSecretEnvelope {
            schema_version: 1,
            provider: "custom".to_string(),
            base_url: "https://example.test/v1".to_string(),
            secret: "saved-key".to_string(),
        })
        .expect("secret envelope should serialize");

        assert_eq!(
            provider_secret_value_for_scope(
                &stored_secret,
                "openai_chatgpt",
                "https://example.test/v1",
                false,
            ),
            None,
        );
        assert_eq!(
            provider_secret_value_for_scope(
                &stored_secret,
                "custom",
                "https://other.test/v1",
                false,
            ),
            None,
        );
    }

    #[test]
    fn unscoped_secret_requires_explicit_compatibility() {
        assert_eq!(
            provider_secret_value_for_scope("saved-key", "custom", "https://example.test", false),
            None,
        );
        assert_eq!(
            provider_secret_value_for_scope(
                "saved-key",
                "openai",
                "https://api.openai.com/v1",
                true
            ),
            Some("saved-key".to_string()),
        );
    }
}
