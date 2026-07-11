import type { PromptPresetThreadChoiceSelections } from "./prompt-presets";

type RoleplayThreadKind = "roleplay";
type RoleplayThreadMode = "scene";
type RoleplayEntryRole = "scene" | "persona" | "character" | "narration";
type RoleplayEntryOrigin = "manual" | "generated" | "imported" | "sample";

export interface RoleplayEntry {
  id: string;
  schemaVersion: 1;
  threadId: string;
  role: RoleplayEntryRole;
  characterId: string | null;
  personaId: string | null;
  label: string;
  body: string;
  origin: RoleplayEntryOrigin;
  createdAt: string;
  updatedAt: string;
}

export interface RoleplayThread {
  id: string;
  schemaVersion: 1;
  kind: RoleplayThreadKind;
  mode: RoleplayThreadMode;
  title: string;
  sceneText: string;
  characterIds: string[];
  activePersonaId: string | null;
  lorebookIds: string[];
  presetId: string | null;
  presetChoiceSelections?: PromptPresetThreadChoiceSelections;
  providerConnectionId: string | null;
  entries: RoleplayEntry[];
  createdAt: string;
  updatedAt: string;
}

export type RoleplayThreadRecord = Omit<RoleplayThread, "entries">;

export function toRoleplayThreadRecord(thread: RoleplayThread): RoleplayThreadRecord {
  const { entries, ...record } = thread;
  void entries;
  return record;
}

export function extractRoleplayEntries(threads: readonly RoleplayThread[]): RoleplayEntry[] {
  return threads.flatMap((thread) =>
    thread.entries.map((entry) => ({
      ...entry,
      schemaVersion: 1,
      threadId: thread.id,
    })),
  );
}

function mergeRoleplayEntries(
  embeddedEntries: readonly RoleplayEntry[],
  storedEntries: readonly RoleplayEntry[],
) {
  if (storedEntries.length === 0) return [...embeddedEntries];

  const storedEntryIds = new Set(storedEntries.map((entry) => entry.id));
  const embeddedOnlyEntries = embeddedEntries.filter((entry) => !storedEntryIds.has(entry.id));

  return [...embeddedOnlyEntries, ...storedEntries];
}

export function attachRoleplayEntriesToThreads(
  threads: readonly (RoleplayThread | RoleplayThreadRecord)[],
  entries: readonly RoleplayEntry[],
): RoleplayThread[] {
  const entriesByThreadId = new Map<string, RoleplayEntry[]>();
  for (const entry of entries) {
    const threadEntries = entriesByThreadId.get(entry.threadId) ?? [];
    threadEntries.push(entry);
    entriesByThreadId.set(entry.threadId, threadEntries);
  }

  return threads.map((thread) => {
    const embeddedEntries =
      "entries" in thread && Array.isArray(thread.entries) ? thread.entries : [];
    const storedEntries = entriesByThreadId.get(thread.id) ?? [];

    return {
      ...toRoleplayThreadRecord({
        ...thread,
        entries: embeddedEntries,
      }),
      entries: mergeRoleplayEntries(embeddedEntries, storedEntries),
    };
  });
}

export function getRoleplayThreadActivityAt(thread: RoleplayThread) {
  return thread.entries.reduce(
    (latest, entry) => (entry.updatedAt.localeCompare(latest) > 0 ? entry.updatedAt : latest),
    thread.updatedAt,
  );
}
