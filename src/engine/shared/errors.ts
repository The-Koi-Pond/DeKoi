// Keep unknown-error formatting in sync with src/shared/errors.ts across the engine boundary.
export function errorMessage(error: unknown, fallback = "Unknown error.") {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message.trim() ? message : fallback;
}
