pub(super) fn as_object<'a>(
    value: &'a serde_json::Value,
    name: &str,
) -> Result<&'a serde_json::Map<String, serde_json::Value>, String> {
    value
        .as_object()
        .ok_or_else(|| format!("{name} must be an object."))
}

pub(super) fn read_number_field(value: &serde_json::Value, key: &str, fallback: f64) -> f64 {
    value
        .get(key)
        .and_then(|field| field.as_f64())
        .filter(|field| field.is_finite())
        .unwrap_or(fallback)
}

pub(super) fn read_u64_field(value: &serde_json::Value, key: &str, fallback: u64) -> u64 {
    value
        .get(key)
        .and_then(|field| field.as_u64())
        .unwrap_or(fallback)
}
