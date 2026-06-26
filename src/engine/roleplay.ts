export const ROLEPLAY_SURFACE_LABEL = "Roleplay";

export type RoleplayThreadKind = "roleplay";
export type RoleplayThreadMode = "scene";
export type RoleplayEntryRole = "scene" | "persona" | "character" | "narration";
export type RoleplayEntryOrigin = "manual" | "generated" | "imported" | "sample";

export interface RoleplayEntry {
  id: string;
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
  providerConnectionId: string | null;
  entries: RoleplayEntry[];
  createdAt: string;
  updatedAt: string;
}
