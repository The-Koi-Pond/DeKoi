export function currentIsoTimestamp() {
  return new Date().toISOString();
}

/** Returns the host IANA time zone when `Intl` exposes one, otherwise `null`. */
export function currentLocalTimeZone() {
  const timeZone = new Intl.DateTimeFormat().resolvedOptions().timeZone;
  return typeof timeZone === "string" && timeZone.trim() ? timeZone : null;
}
