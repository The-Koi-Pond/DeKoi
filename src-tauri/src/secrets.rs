const PROVIDER_SECRET_SERVICE: &str = "com.xelvanas.dekoi.provider-key";

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
) -> Result<ProviderSecretStatus, String> {
    let trimmed_secret = secret.trim();
    if trimmed_secret.is_empty() {
        return Err("Provider key cannot be empty.".to_string());
    }

    let entry = provider_secret_entry(&connection_id)?;
    entry
        .set_password(trimmed_secret)
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
