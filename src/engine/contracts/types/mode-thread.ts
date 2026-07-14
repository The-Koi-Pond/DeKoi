import type { PromptPresetThreadChoiceSelections } from "./prompt-presets";

type NonEmptyArray<T> = [T, ...T[]];
export type ModeThreadKind = "messenger" | "roleplay";
type ModeParticipantMode = "direct" | "group";
export type RoleplayReplyStrategy = "natural" | "manual" | "ordered" | "round-robin";

export type ModeMessageAuthor =
  | { kind: "persona"; personaId: string; label: string }
  | { kind: "character"; characterId: string; label: string }
  | { kind: "system"; label: string }
  | { kind: "unknown"; label: string };
export type ModeMessageOrigin = "manual" | "generated" | "imported" | "sample";

export interface ModeMessageVersion {
  id: string;
  body: string;
  origin: ModeMessageOrigin;
  createdAt: string;
  updatedAt: string;
}
export interface ModeMessage {
  id: string;
  schemaVersion: 1;
  threadId: string;
  branchId: string;
  author: ModeMessageAuthor;
  versions: NonEmptyArray<ModeMessageVersion>;
  activeVersionId: string;
  createdAt: string;
  updatedAt: string;
}

interface ModeBranchBase {
  id: string;
  schemaVersion: 1;
  threadId: string;
  participantMode: ModeParticipantMode;
  characterIds: string[];
  activePersonaId: string | null;
  lorebookIds: string[];
  presetId: string | null;
  presetChoiceSelectionsByPresetId: Record<string, PromptPresetThreadChoiceSelections>;
  providerConnectionId: string | null;
  systemPromptMode: "default" | "custom";
  systemPrompt: string;
  createdAt: string;
  updatedAt: string;
}
export interface MessengerModeBranch extends ModeBranchBase {
  kind: "messenger";
}
export interface RoleplayModeBranch extends ModeBranchBase {
  kind: "roleplay";
  replyStrategy: RoleplayReplyStrategy;
}
export type ModeBranch = MessengerModeBranch | RoleplayModeBranch;

interface ModeThreadBase {
  id: string;
  schemaVersion: 1;
  title: string;
  activeBranchId: string;
  messages: ModeMessage[];
  createdAt: string;
  updatedAt: string;
}
export interface MessengerModeThread extends ModeThreadBase {
  kind: "messenger";
  branches: NonEmptyArray<MessengerModeBranch>;
}
export interface RoleplayModeThread extends ModeThreadBase {
  kind: "roleplay";
  openingCharacterId: string | null;
  branches: NonEmptyArray<RoleplayModeBranch>;
}
export type ModeThread = MessengerModeThread | RoleplayModeThread;

export type ModeThreadOfKind<K extends ModeThreadKind> = Extract<ModeThread, { kind: K }>;
export type ModeBranchOfKind<K extends ModeThreadKind> = Extract<ModeBranch, { kind: K }>;
