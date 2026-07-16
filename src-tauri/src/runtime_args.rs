pub(crate) fn runtime_args_object<'a>(
    args: &'a serde_json::Value,
    command: &str,
) -> Result<&'a serde_json::Map<String, serde_json::Value>, String> {
    args.as_object()
        .ok_or_else(|| format!("{command} requires args."))
}
