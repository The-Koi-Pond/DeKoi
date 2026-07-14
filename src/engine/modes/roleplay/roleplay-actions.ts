import type { CharacterRecord } from "../../contracts/types/character";
import type { PersonaRecord } from "../../contracts/types/persona";
import type {
  RoleplayModeThread,
  ModeMessage,
  RoleplayReplyStrategy,
} from "../../contracts/types/mode-thread";
import {
  appendModeMessages,
  clearModeBranchMessages,
  createModeMessage,
  createRoleplayModeBranch,
  deleteModeMessage,
  editActiveModeMessageVersion,
  getActiveModeBranch,
  getActiveModeBranchMessages,
  renameModeThread,
  setModeBranchLorebooks,
  setModeBranchParticipants,
  setModeBranchPersona,
  setModeBranchPreset,
  setModeBranchPresetChoiceSelections,
  setModeBranchProviderConnection,
  clearModeThreadPersona,
} from "../mode-thread/mode-thread-actions";
import type { PromptPresetThreadChoiceSelections } from "../../contracts/types/prompt-presets";
import { cleanText } from "../../shared/text";
import { assertValidModeThread } from "../mode-thread/mode-thread-actions";
import { canonicalId, timestamp } from "../mode-thread/mode-thread-validation";

type OpeningCharacter = Pick<CharacterRecord, "id" | "displayName">;
export interface RoleplayThreadCreationInput {
  id: string;
  branchId: string;
  title: string;
  characterIds: string[];
  activePersonaId: string | null;
  openingCharacter: OpeningCharacter | null;
  replyStrategy?: RoleplayReplyStrategy;
  now: string;
  lorebookIds?: string[];
  defaultPromptPresetId?: string | null;
  providerConnectionId?: string | null;
  systemPromptMode?: "default" | "custom";
  systemPrompt?: string;
  greetingText?: string;
  greetingMessageId?: string;
  greetingVersionId?: string;
}

export function createRoleplayThread(input: RoleplayThreadCreationInput): RoleplayModeThread {
  const threadId = canonicalId(input.id, "thread id");
  const branchId = canonicalId(input.branchId, "branch id");
  const createdAt = timestamp(input.now, "thread timestamp");
  const characterIds = input.characterIds.map((id) => canonicalId(id, "character id"));
  const openingCharacterId = input.openingCharacter
    ? canonicalId(input.openingCharacter.id, "opening character")
    : null;
  if (openingCharacterId && !characterIds.includes(openingCharacterId))
    throw new Error("Opening character must be a participant");
  const greeting = input.greetingText?.trim() || "";
  const greetingIdsProvided =
    input.greetingMessageId !== undefined || input.greetingVersionId !== undefined;
  if (greetingIdsProvided && (!input.greetingMessageId || !input.greetingVersionId))
    throw new Error("Greeting message and version IDs are required together");
  const branch = createRoleplayModeBranch({
    ...input,
    characterIds,
    id: branchId,
    threadId,
    presetId: input.defaultPromptPresetId,
    replyStrategy: input.replyStrategy ?? "natural",
  });
  const thread: RoleplayModeThread = {
    id: threadId,
    schemaVersion: 1,
    kind: "roleplay",
    title: cleanText(input.title, "New Roleplay Chat"),
    activeBranchId: branch.id,
    openingCharacterId,
    branches: [branch],
    messages: [],
    createdAt,
    updatedAt: createdAt,
  };
  if (greeting && openingCharacterId && input.greetingMessageId && input.greetingVersionId) {
    const greetingMessage = createModeMessage({
      id: input.greetingMessageId,
      versionId: input.greetingVersionId,
      threadId: thread.id,
      branchId: branch.id,
      author: {
        kind: "character",
        characterId: openingCharacterId,
        label: input.openingCharacter!.displayName,
      },
      body: greeting,
      origin: "sample",
      now: createdAt,
    });
    thread.messages = [greetingMessage];
  }
  assertValidModeThread(thread);
  return thread;
}

export const renameRoleplayThread = (t: RoleplayModeThread, title: string, at: string) =>
  renameModeThread(t, title, at);
export const appendRoleplayMessages = (
  t: RoleplayModeThread,
  messages: readonly ModeMessage[],
  branchId = t.activeBranchId,
) => appendModeMessages(t, messages, branchId);
export const clearRoleplayMessages = (t: RoleplayModeThread) => clearModeBranchMessages(t);
export const updateRoleplayMessageBody = (
  t: RoleplayModeThread,
  id: string,
  body: string,
  at: string,
) => editActiveModeMessageVersion(t, id, body, at);
export const deleteRoleplayMessage = (t: RoleplayModeThread, id: string) =>
  deleteModeMessage(t, id);
export const setRoleplayThreadParticipants = (t: RoleplayModeThread, ids: string[], at: string) =>
  setModeBranchParticipants(t, t.activeBranchId, ids, at);
export const setRoleplayThreadPersona = (t: RoleplayModeThread, id: string | null, at: string) =>
  setModeBranchPersona(t, t.activeBranchId, id, at);
export const setRoleplayThreadLorebooks = (t: RoleplayModeThread, ids: string[], at: string) =>
  setModeBranchLorebooks(t, t.activeBranchId, ids, at);
export const setRoleplayThreadProviderConnection = (
  t: RoleplayModeThread,
  id: string | null,
  at: string,
) => setModeBranchProviderConnection(t, t.activeBranchId, id, at);
export const setRoleplayThreadPreset = (
  t: RoleplayModeThread,
  id: string | null,
  at: string,
  c?: PromptPresetThreadChoiceSelections,
) => setModeBranchPreset(t, t.activeBranchId, id, at, c);
export const setRoleplayThreadPresetChoiceSelections = (
  t: RoleplayModeThread,
  c: PromptPresetThreadChoiceSelections,
  at: string,
) => setModeBranchPresetChoiceSelections(t, t.activeBranchId, c, at);
export function clearRoleplayThreadPersona(
  thread: RoleplayModeThread,
  personaId: string,
  at: string,
) {
  return clearModeThreadPersona(thread, personaId, at);
}
function make(
  t: RoleplayModeThread,
  id: string,
  versionId: string,
  author: ModeMessage["author"],
  body: string,
  now: string,
  origin: "manual" | "generated",
) {
  return createModeMessage({
    id,
    versionId,
    threadId: t.id,
    branchId: getActiveModeBranch(t).id,
    author,
    body: body.trim(),
    origin,
    now,
  });
}
export const createPersonaRoleplayMessage = ({
  body,
  id,
  versionId,
  now,
  persona,
  thread,
}: {
  body: string;
  id: string;
  versionId: string;
  now: string;
  persona: PersonaRecord;
  thread: RoleplayModeThread;
}) =>
  make(
    thread,
    id,
    versionId,
    { kind: "persona", personaId: persona.id, label: persona.displayName },
    body,
    now,
    "manual",
  );
export const createCompanionRoleplayMessage = ({
  body,
  id,
  versionId,
  now,
  companion,
  thread,
}: {
  body: string;
  id: string;
  versionId: string;
  now: string;
  companion: CharacterRecord;
  thread: RoleplayModeThread;
}) =>
  make(
    thread,
    id,
    versionId,
    { kind: "character", characterId: companion.id, label: companion.displayName },
    body,
    now,
    "manual",
  );
export const createSystemRoleplayMessage = ({
  body,
  id,
  versionId,
  now,
  thread,
}: {
  body: string;
  id: string;
  versionId: string;
  now: string;
  thread: RoleplayModeThread;
}) => make(thread, id, versionId, { kind: "system", label: "System" }, body, now, "manual");
export const createGeneratedRoleplayMessage = ({
  body,
  id,
  versionId,
  now,
  companion,
  thread,
}: {
  body: string;
  id: string;
  versionId: string;
  now: string;
  companion: CharacterRecord;
  thread: RoleplayModeThread;
}) =>
  make(
    thread,
    id,
    versionId,
    { kind: "character", characterId: companion.id, label: companion.displayName },
    body,
    now,
    "generated",
  );

export function getNextRoleplayCompanion(
  thread: RoleplayModeThread,
  companions: CharacterRecord[],
) {
  const branch = getActiveModeBranch(thread);
  const companionsById = new Map(companions.map((companion) => [companion.id, companion]));
  const available = branch.characterIds
    .map((characterId) => companionsById.get(characterId))
    .filter((companion): companion is CharacterRecord => companion !== undefined);
  if (!available.length || branch.replyStrategy === "manual") return null;
  const messages = getActiveModeBranchMessages(thread);
  const turnBoundaryIndex = [...messages]
    .map((message) => message.author.kind === "persona" || message.author.kind === "system")
    .lastIndexOf(true);
  const activeCharacterIds = new Set(branch.characterIds);
  const activeCharacterMessageCount = messages.filter(
    (message) =>
      message.author.kind === "character" && activeCharacterIds.has(message.author.characterId),
  ).length;
  const replied = new Set(
    messages
      .slice(turnBoundaryIndex + 1)
      .filter(
        (message) =>
          message.author.kind === "character" && activeCharacterIds.has(message.author.characterId),
      )
      .map((m) => (m.author.kind === "character" ? m.author.characterId : "")),
  );
  if (branch.replyStrategy === "round-robin")
    return available.find((c) => !replied.has(c.id)) ?? available[0];
  if (branch.replyStrategy === "ordered")
    return available[activeCharacterMessageCount % available.length];
  if (thread.openingCharacterId && activeCharacterMessageCount === 0)
    return (
      available.find((character) => character.id === thread.openingCharacterId) ?? available[0]
    );
  return available[activeCharacterMessageCount % available.length];
}
