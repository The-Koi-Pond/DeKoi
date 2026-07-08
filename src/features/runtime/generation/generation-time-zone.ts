import { currentLocalTimeZone } from "../../../shared/browser/current-time";

/**
 * Preserves explicit time-zone overrides, otherwise detects the host local zone.
 * Returning `null` leaves the engine resolver on its UTC fallback.
 */
export function resolveGenerationTimeZone(timeZone: string | null | undefined) {
  return timeZone ?? currentLocalTimeZone();
}
