export const CLASSIC_SURFACE_LABEL = "Classic";

export type ClassicThreadKind = "classic";
export type ClassicThreadMode = "scene";
export type ClassicEntryRole = "scene" | "persona" | "character" | "narration";
export type ClassicEntryOrigin = "manual" | "generated" | "imported" | "sample";

export interface ClassicEntry {
  id: string;
  threadId: string;
  role: ClassicEntryRole;
  characterId: string | null;
  personaId: string | null;
  label: string;
  body: string;
  origin: ClassicEntryOrigin;
  createdAt: string;
  updatedAt: string;
}

export interface ClassicThread {
  id: string;
  schemaVersion: 1;
  kind: ClassicThreadKind;
  mode: ClassicThreadMode;
  title: string;
  sceneText: string;
  characterIds: string[];
  activePersonaId: string | null;
  lorebookIds: string[];
  providerConnectionId: string | null;
  entries: ClassicEntry[];
  createdAt: string;
  updatedAt: string;
}
