mod auth;
mod connection_check;
mod endpoints;
mod generation;
mod http;
mod models;
mod prompt;
mod value;

use std::time::Duration;

pub(crate) use connection_check::provider_connection_check;
pub(crate) use generation::generation_generate;
pub(crate) use models::provider_connection_models;

const PROVIDER_CONNECTION_TIMEOUT: Duration = Duration::from_secs(30);
const PROVIDER_GENERATION_TIMEOUT: Duration = Duration::from_secs(120);
