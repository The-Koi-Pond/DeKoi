pub(super) fn as_object<'a>(
    value: &'a serde_json::Value,
    name: &str,
) -> Result<&'a serde_json::Map<String, serde_json::Value>, String> {
    value
        .as_object()
        .ok_or_else(|| format!("{name} must be an object."))
}
