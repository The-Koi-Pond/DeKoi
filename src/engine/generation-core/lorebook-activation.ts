import type {
  LorebookActivationSettings,
  LorebookRecord,
  LoreEntryRecord,
} from "../contracts/types/lorebook";

// Pure lorebook activation helpers for generation prompt assembly. This module
// does not know about Messenger, Roleplay, React, storage, or runtime transport.

/** Transcript item used as lore activation scan input. */
export interface LorebookScanSource {
  name?: string | null;
  body: string | null | undefined;
}

/** Activated entry plus match provenance for prompt/debug surfaces. */
export interface ActivatedLoreEntry {
  lorebookId: string;
  lorebookTitle: string;
  entry: LoreEntryRecord;
  matchReason: "constant" | "primary-key";
  matchedKey: string | null;
}

function isRegexLikeKey(key: string) {
  return /^\/.+\/[A-Za-z]*$/.test(key.trim());
}

function isWordCharacter(value: string | undefined) {
  return !!value && /[A-Za-z0-9_]/.test(value);
}

/**
 * Builds the transcript slice scanned by selective lore entries. A scan depth
 * of 0 scans nothing; otherwise only the most recent N sources are included.
 */
export function buildScanBuffer(
  sources: LorebookScanSource[],
  activation: Pick<LorebookActivationSettings, "scanDepth" | "includeNames">,
) {
  const scanDepth = Math.max(0, activation.scanDepth);
  const selectedSources =
    scanDepth === 0 ? [] : sources.slice(Math.max(0, sources.length - scanDepth));

  return selectedSources
    .map((source) => {
      const body = source.body?.trim() ?? "";
      const name = activation.includeNames ? source.name?.trim() : "";
      return [name, body].filter(Boolean).join(": ");
    })
    .filter(Boolean)
    .join("\n");
}

/**
 * Matches plaintext keys only. Regex-like slash keys are intentionally deferred
 * and return false until regex activation is implemented.
 */
export function matchKey(
  key: string,
  scanBuffer: string,
  activation: Pick<
    LorebookActivationSettings,
    "caseSensitiveKeys" | "matchWholeWords"
  >,
) {
  const trimmedKey = key.trim();
  if (!trimmedKey || isRegexLikeKey(trimmedKey)) return false;

  const haystack = activation.caseSensitiveKeys
    ? scanBuffer
    : scanBuffer.toLowerCase();
  const needle = activation.caseSensitiveKeys
    ? trimmedKey
    : trimmedKey.toLowerCase();

  if (!activation.matchWholeWords) return haystack.includes(needle);

  let index = haystack.indexOf(needle);
  while (index !== -1) {
    const before = index > 0 ? haystack[index - 1] : undefined;
    const after = haystack[index + needle.length];
    if (!isWordCharacter(before) && !isWordCharacter(after)) return true;
    index = haystack.indexOf(needle, index + 1);
  }

  return false;
}

function entryHasBody(entry: LoreEntryRecord) {
  return entry.body.trim().length > 0;
}

function activateEntry(
  lorebook: LorebookRecord,
  entry: LoreEntryRecord,
  scanBuffer: string,
): ActivatedLoreEntry | null {
  if (!entry.enabled || !entryHasBody(entry)) return null;
  if (entry.strategy === "constant") {
    return {
      lorebookId: lorebook.id,
      lorebookTitle: lorebook.title,
      entry,
      matchReason: "constant",
      matchedKey: null,
    };
  }

  const primaryKeys = entry.key?.map((key) => key.trim()).filter(Boolean) ?? [];
  if (primaryKeys.length === 0) return null;

  const matchedKey =
    primaryKeys.find((key) => matchKey(key, scanBuffer, lorebook.activation)) ??
    null;
  if (!matchedKey) return null;

  return {
    lorebookId: lorebook.id,
    lorebookTitle: lorebook.title,
    entry,
    matchReason: "primary-key",
    matchedKey,
  };
}

/**
 * Returns enabled, non-empty lore entries that activate against the provided
 * scan text, including provenance for later prompt/debug surfaces.
 */
export function activateLorebookEntries(
  lorebook: LorebookRecord,
  scanBuffer: string,
) {
  return lorebook.entries.flatMap((entry) => {
    const activatedEntry = activateEntry(lorebook, entry, scanBuffer);
    return activatedEntry ? [activatedEntry] : [];
  });
}
