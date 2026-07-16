import type { CharacterRecord } from "../../contracts/types/character";
import type { PersonaRecord } from "../../contracts/types/persona";
import type { MessengerModeThread, ModeMessage } from "../../contracts/types/mode-thread";
import {
  appendModeMessages,
  clearModeBranchMessages,
  createMessengerModeBranch,
  createModeMessage,
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
  removeModeThreadCharacter,
  assertValidModeThread,
} from "../mode-thread/mode-thread-actions";
import type { PromptPresetThreadChoiceSelections } from "../../contracts/types/prompt-presets";
import { cleanText } from "../../shared/text";
import { canonicalId, timestamp } from "../mode-thread/mode-thread-validation";

export interface MessengerThreadCreationInput {
  id: string;
  branchId: string;
  title: string;
  characterIds: string[];
  activePersonaId: string | null;
  now: string;
  lorebookIds?: string[];
  defaultPromptPresetId?: string | null;
  providerConnectionId?: string | null;
}

export function createMessengerThread(input: MessengerThreadCreationInput): MessengerModeThread {
  const threadId = canonicalId(input.id, "thread id");
  const branchId = canonicalId(input.branchId, "branch id");
  const createdAt = timestamp(input.now, "thread timestamp");
  const branch = createMessengerModeBranch({
    ...input,
    id: branchId,
    threadId,
    presetId: input.defaultPromptPresetId,
  });
  const thread: MessengerModeThread = {
    id: threadId,
    schemaVersion: 1,
    kind: "messenger",
    title: cleanText(input.title, "New Messenger Chat"),
    activeBranchId: branch.id,
    branches: [branch],
    messages: [],
    createdAt,
    updatedAt: createdAt,
  };
  assertValidModeThread(thread);
  return thread;
}

export const appendMessengerMessages = (
  thread: MessengerModeThread,
  messages: readonly ModeMessage[],
  branchId = thread.activeBranchId,
) => appendModeMessages(thread, messages, branchId);
export const clearMessengerMessages = (thread: MessengerModeThread) =>
  clearModeBranchMessages(thread);
export const updateMessengerMessageBody = (
  thread: MessengerModeThread,
  messageId: string,
  body: string,
  updatedAt: string,
) => editActiveModeMessageVersion(thread, messageId, body, updatedAt);
export const deleteMessengerMessage = (thread: MessengerModeThread, messageId: string) =>
  deleteModeMessage(thread, messageId);
export const renameMessengerThread = (
  thread: MessengerModeThread,
  title: string,
  updatedAt: string,
) => renameModeThread(thread, title, updatedAt);
export const setMessengerThreadParticipants = (
  thread: MessengerModeThread,
  ids: string[],
  at: string,
) => setModeBranchParticipants(thread, thread.activeBranchId, ids, at);
export const setMessengerThreadPersona = (
  thread: MessengerModeThread,
  id: string | null,
  at: string,
) => setModeBranchPersona(thread, thread.activeBranchId, id, at);
export const setMessengerThreadLorebooks = (
  thread: MessengerModeThread,
  ids: string[],
  at: string,
) => setModeBranchLorebooks(thread, thread.activeBranchId, ids, at);
export const setMessengerThreadProviderConnection = (
  thread: MessengerModeThread,
  id: string | null,
  at: string,
) => setModeBranchProviderConnection(thread, thread.activeBranchId, id, at);
export const setMessengerThreadPreset = (
  thread: MessengerModeThread,
  id: string | null,
  at: string,
  choices?: PromptPresetThreadChoiceSelections,
) => setModeBranchPreset(thread, thread.activeBranchId, id, at, choices);
export const setMessengerThreadPresetChoiceSelections = (
  thread: MessengerModeThread,
  choices: PromptPresetThreadChoiceSelections,
  at: string,
) => setModeBranchPresetChoiceSelections(thread, thread.activeBranchId, choices, at);
export function removeMessengerThreadCharacter(
  thread: MessengerModeThread,
  characterId: string,
  at: string,
) {
  return removeModeThreadCharacter(thread, characterId, at);
}
function messageInput(
  thread: MessengerModeThread,
  id: string,
  versionId: string,
  author: ModeMessage["author"],
  body: string,
  now: string,
  origin: "manual" | "generated",
): ModeMessage {
  return createModeMessage({
    id,
    versionId,
    threadId: thread.id,
    branchId: getActiveModeBranch(thread).id,
    author,
    body: body.trim(),
    origin,
    now,
  });
}
export const createPersonaMessengerMessage = ({
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
  thread: MessengerModeThread;
}) =>
  messageInput(
    thread,
    id,
    versionId,
    { kind: "persona", personaId: persona.id, label: persona.displayName },
    body,
    now,
    "manual",
  );
export const createAnonymousMessengerMessage = ({
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
  thread: MessengerModeThread;
}) =>
  messageInput(thread, id, versionId, { kind: "unknown", label: "Anonymous" }, body, now, "manual");
export const createGeneratedCompanionMessage = ({
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
  thread: MessengerModeThread;
}) =>
  messageInput(
    thread,
    id,
    versionId,
    { kind: "character", characterId: companion.id, label: companion.displayName },
    body,
    now,
    "generated",
  );

export function getNextMessengerCompanion(
  thread: MessengerModeThread,
  companions: CharacterRecord[],
) {
  const branch = getActiveModeBranch(thread);
  const available = companions.filter((c) => branch.characterIds.includes(c.id));
  if (!available.length) return null;
  const count = getActiveModeBranchMessages(thread).filter(
    (m) => m.author.kind === "character",
  ).length;
  return available[count % available.length];
}
