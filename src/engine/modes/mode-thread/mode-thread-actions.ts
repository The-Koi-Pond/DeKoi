import type { PromptPresetThreadChoiceSelections } from "../../contracts/types/prompt-presets";
import { normalizePromptPresetThreadChoiceSelections } from "../../prompt-presets/prompt-preset-normalization";
import { cleanTextArray } from "../../shared/text";
import type {
  ModeBranch,
  ModeBranchOfKind,
  MessengerModeBranch,
  ModeMessage,
  ModeMessageAuthor,
  ModeMessageOrigin,
  ModeMessageVersion,
  RoleplayModeBranch,
  RoleplayReplyStrategy,
  ModeThread,
  ModeThreadKind,
  ModeThreadOfKind,
} from "../../contracts/types/mode-thread";
import {
  assertValidModeThread,
  canonicalId,
  timestamp,
  timestampAtOrAfter,
  validateModeMessage,
  validateModeMessageAuthor,
  validateModeMessageOrigin,
  validateRoleplayReplyStrategy,
} from "./mode-thread-validation";
export { assertValidModeThread } from "./mode-thread-validation";

const fail = (message: string): never => {
  throw new Error(`Invalid mode thread: ${message}`);
};

type PresetChoiceHistory = Record<string, PromptPresetThreadChoiceSelections>;

const copyPresetChoiceHistory = (history?: Readonly<PresetChoiceHistory>): PresetChoiceHistory =>
  Object.assign(Object.create(null) as PresetChoiceHistory, history);

export interface ModeBranchCreationInput {
  id: string;
  threadId: string;
  characterIds: string[];
  activePersonaId: string | null;
  lorebookIds?: string[];
  presetId?: string | null;
  providerConnectionId?: string | null;
  systemPromptMode?: "default" | "custom";
  systemPrompt?: string;
  now: string;
}

function createModeBranchBase(input: ModeBranchCreationInput) {
  const characterIds = cleanTextArray(input.characterIds);
  const now = timestamp(input.now, "branch timestamp");
  return {
    id: canonicalId(input.id, "branch id"),
    schemaVersion: 1 as const,
    threadId: canonicalId(input.threadId, "thread id"),
    participantMode: characterIds.length > 1 ? ("group" as const) : ("direct" as const),
    characterIds,
    activePersonaId: input.activePersonaId?.trim() || null,
    lorebookIds: cleanTextArray(input.lorebookIds ?? []),
    presetId: input.presetId?.trim() || null,
    presetChoiceSelectionsByPresetId: copyPresetChoiceHistory(),
    providerConnectionId: input.providerConnectionId?.trim() || null,
    systemPromptMode: input.systemPromptMode ?? "default",
    systemPrompt: input.systemPromptMode === "custom" ? input.systemPrompt?.trim() || "" : "",
    createdAt: now,
    updatedAt: now,
  };
}

export function createMessengerModeBranch(input: ModeBranchCreationInput): MessengerModeBranch {
  return { ...createModeBranchBase(input), kind: "messenger" };
}

export function createRoleplayModeBranch(
  input: ModeBranchCreationInput & { replyStrategy: RoleplayReplyStrategy },
): RoleplayModeBranch {
  validateRoleplayReplyStrategy(input.replyStrategy);
  return { ...createModeBranchBase(input), kind: "roleplay", replyStrategy: input.replyStrategy };
}

export function createModeMessage({
  author,
  body,
  branchId,
  id,
  origin,
  threadId,
  versionId,
  now,
}: {
  author: ModeMessageAuthor;
  body: string;
  branchId: string;
  id: string;
  origin: ModeMessageOrigin;
  threadId: string;
  versionId: string;
  now: string;
}): ModeMessage {
  validateModeMessageAuthor(author);
  validateModeMessageOrigin(origin);
  const createdAt = timestamp(now, "message timestamp");
  const messageId = canonicalId(id, "message id");
  const activeVersionId = canonicalId(versionId, "version id");
  return {
    id: messageId,
    schemaVersion: 1,
    threadId: canonicalId(threadId, "thread id"),
    branchId: canonicalId(branchId, "branch id"),
    author,
    versions: [
      {
        id: activeVersionId,
        body,
        origin,
        createdAt,
        updatedAt: createdAt,
      },
    ],
    activeVersionId,
    createdAt,
    updatedAt: createdAt,
  };
}

export function getActiveModeBranch<T extends ModeThread>(thread: T): ModeBranchOfKind<T["kind"]>;
export function getActiveModeBranch<K extends ModeThreadKind>(
  thread: ModeThreadOfKind<K>,
): ModeBranchOfKind<K>;
export function getActiveModeBranch(thread: ModeThread): ModeBranch {
  assertValidModeThread(thread);
  return thread.branches.find((branch) => branch.id === thread.activeBranchId)!;
}

export function getActiveModeMessageVersion(message: ModeMessage): ModeMessageVersion {
  const version = message.versions.find((item) => item.id === message.activeVersionId);
  return version ?? fail("active version");
}

export function getActiveModeBranchMessages(thread: ModeThread): ModeMessage[] {
  const branch = getActiveModeBranch(thread);
  return thread.messages.filter((message) => message.branchId === branch.id);
}

/** Returns a provider-safe immutable projection containing only the active branch and versions. */
export function createActiveModeThreadSnapshot<T extends ModeThread>(thread: T): T {
  assertValidModeThread(thread);
  const branch = getActiveModeBranch(thread);
  const messages = thread.messages
    .filter((message) => message.branchId === branch.id)
    .map((message) => ({
      ...message,
      versions: [getActiveModeMessageVersion(message)],
    }));
  return {
    ...thread,
    branches: [branch],
    messages,
  } as T;
}

function branchFor<K extends ModeThreadKind>(
  thread: ModeThreadOfKind<K>,
  branchId: string,
): ModeBranchOfKind<K> {
  assertValidModeThread(thread);
  const branch = thread.branches.find((item): item is ModeBranchOfKind<K> => item.id === branchId);
  return branch ?? fail("target branch");
}

function assertMessageInBranch<K extends ModeThreadKind>(
  thread: ModeThreadOfKind<K>,
  messageId: string,
  branchId: string,
): ModeMessage {
  branchFor(thread, branchId);
  return (
    thread.messages.find((message) => message.id === messageId && message.branchId === branchId) ??
    fail("target message")
  );
}

export function appendModeMessages<K extends ModeThreadKind>(
  thread: ModeThreadOfKind<K>,
  messages: readonly ModeMessage[],
  branchId = thread.activeBranchId,
): ModeThreadOfKind<K> {
  branchFor(thread, branchId);
  const existing = new Set(thread.messages.map((message) => message.id));
  const branchIds = new Set(thread.branches.map((branch) => branch.id));
  const incoming = new Set<string>();
  for (const message of messages) {
    if (
      incoming.has(message.id) ||
      existing.has(message.id) ||
      message.threadId !== thread.id ||
      message.branchId !== branchId
    )
      fail("message ownership or duplicate");
    incoming.add(message.id);
    validateModeMessage(message, thread.id, branchIds);
  }
  return { ...thread, messages: [...thread.messages, ...messages] };
}

export function editActiveModeMessageVersion<K extends ModeThreadKind>(
  thread: ModeThreadOfKind<K>,
  messageId: string,
  body: string,
  updatedAt: string,
  branchId = thread.activeBranchId,
): ModeThreadOfKind<K> {
  const message = assertMessageInBranch(thread, messageId, branchId);
  const version = getActiveModeMessageVersion(message);
  timestampAtOrAfter(updatedAt, message.updatedAt, "updatedAt", "message updatedAt");
  const nextUpdatedAt = timestampAtOrAfter(
    updatedAt,
    version.updatedAt,
    "updatedAt",
    "active version updatedAt",
  );
  const cleanBody = body.trim();
  if (!cleanBody) return thread;
  return {
    ...thread,
    messages: thread.messages.map((item) =>
      item.id === messageId
        ? {
            ...item,
            versions: item.versions.map((version) =>
              version.id === item.activeVersionId
                ? { ...version, body: cleanBody, updatedAt: nextUpdatedAt }
                : version,
            ),
            updatedAt: nextUpdatedAt,
          }
        : item,
    ),
  };
}

export function deleteModeMessage<K extends ModeThreadKind>(
  thread: ModeThreadOfKind<K>,
  messageId: string,
  branchId = thread.activeBranchId,
): ModeThreadOfKind<K> {
  assertMessageInBranch(thread, messageId, branchId);
  return { ...thread, messages: thread.messages.filter((message) => message.id !== messageId) };
}

export function clearModeBranchMessages<K extends ModeThreadKind>(
  thread: ModeThreadOfKind<K>,
  branchId = thread.activeBranchId,
): ModeThreadOfKind<K> {
  branchFor(thread, branchId);
  return {
    ...thread,
    messages: thread.messages.filter((message) => message.branchId !== branchId),
  };
}

export function renameModeThread<K extends ModeThreadKind>(
  thread: ModeThreadOfKind<K>,
  title: string,
  updatedAt: string,
): ModeThreadOfKind<K> {
  assertValidModeThread(thread);
  const nextUpdatedAt = timestampAtOrAfter(
    updatedAt,
    thread.updatedAt,
    "updatedAt",
    "thread updatedAt",
  );
  return { ...thread, title: title.trim() || thread.title, updatedAt: nextUpdatedAt };
}

function updateBranch<K extends ModeThreadKind>(
  thread: ModeThreadOfKind<K>,
  branchId: string,
  update: (branch: ModeBranchOfKind<K>) => ModeBranchOfKind<K>,
): ModeThreadOfKind<K> {
  const current = branchFor(thread, branchId);
  const next = update(current);
  if (next === current) return thread;
  const branches = [...thread.branches];
  const index = branches.findIndex((branch) => branch.id === branchId);
  branches[index] = next;
  return { ...thread, branches };
}

const branchUpdateTimestamp = (branch: ModeBranch, updatedAt: string) =>
  timestampAtOrAfter(updatedAt, branch.updatedAt, "updatedAt", "branch updatedAt");

export function setModeBranchParticipants<K extends ModeThreadKind>(
  thread: ModeThreadOfKind<K>,
  branchId: string,
  characterIds: string[],
  updatedAt: string,
): ModeThreadOfKind<K> {
  return updateBranch(thread, branchId, (branch) => {
    const ids = cleanTextArray(characterIds);
    return {
      ...branch,
      characterIds: ids,
      participantMode: ids.length > 1 ? "group" : "direct",
      updatedAt: branchUpdateTimestamp(branch, updatedAt),
    };
  });
}
export function setModeBranchPersona<K extends ModeThreadKind>(
  thread: ModeThreadOfKind<K>,
  branchId: string,
  personaId: string | null,
  updatedAt: string,
): ModeThreadOfKind<K> {
  return updateBranch(thread, branchId, (branch) => ({
    ...branch,
    activePersonaId: personaId?.trim() || null,
    updatedAt: branchUpdateTimestamp(branch, updatedAt),
  }));
}
export function setModeBranchLorebooks<K extends ModeThreadKind>(
  thread: ModeThreadOfKind<K>,
  branchId: string,
  lorebookIds: string[],
  updatedAt: string,
): ModeThreadOfKind<K> {
  return updateBranch(thread, branchId, (branch) => ({
    ...branch,
    lorebookIds: cleanTextArray(lorebookIds),
    updatedAt: branchUpdateTimestamp(branch, updatedAt),
  }));
}
export function setModeBranchPreset<K extends ModeThreadKind>(
  thread: ModeThreadOfKind<K>,
  branchId: string,
  presetId: string | null,
  updatedAt: string,
  choices?: PromptPresetThreadChoiceSelections,
): ModeThreadOfKind<K> {
  return updateBranch(thread, branchId, (branch) => {
    const nextUpdatedAt = branchUpdateTimestamp(branch, updatedAt);
    const id = presetId?.trim() || null;
    if (id === branch.presetId && choices === undefined) return branch;
    const history = copyPresetChoiceHistory(branch.presetChoiceSelectionsByPresetId);
    if (id && choices !== undefined)
      history[id] = normalizePromptPresetThreadChoiceSelections(choices);
    return {
      ...branch,
      presetId: id,
      presetChoiceSelectionsByPresetId: history,
      updatedAt: nextUpdatedAt,
    };
  });
}
export function setModeBranchPresetChoiceSelections<K extends ModeThreadKind>(
  thread: ModeThreadOfKind<K>,
  branchId: string,
  choices: PromptPresetThreadChoiceSelections,
  updatedAt: string,
): ModeThreadOfKind<K> {
  return updateBranch(thread, branchId, (branch) => {
    const nextUpdatedAt = branchUpdateTimestamp(branch, updatedAt);
    if (!branch.presetId) return branch;
    const history = copyPresetChoiceHistory(branch.presetChoiceSelectionsByPresetId);
    history[branch.presetId] = normalizePromptPresetThreadChoiceSelections(choices);
    return {
      ...branch,
      presetChoiceSelectionsByPresetId: history,
      updatedAt: nextUpdatedAt,
    };
  });
}
export function setModeBranchProviderConnection<K extends ModeThreadKind>(
  thread: ModeThreadOfKind<K>,
  branchId: string,
  providerConnectionId: string | null,
  updatedAt: string,
): ModeThreadOfKind<K> {
  return updateBranch(thread, branchId, (branch) => ({
    ...branch,
    providerConnectionId: providerConnectionId?.trim() || null,
    updatedAt: branchUpdateTimestamp(branch, updatedAt),
  }));
}

/** Remove a character reference from every branch, including inactive branches. */
export function removeModeThreadCharacter<K extends ModeThreadKind>(
  thread: ModeThreadOfKind<K>,
  characterId: string,
  updatedAt: string,
): ModeThreadOfKind<K> {
  return thread.branches.reduce(
    (current, branch) =>
      branch.characterIds.includes(characterId)
        ? setModeBranchParticipants(
            current,
            branch.id,
            branch.characterIds.filter((id) => id !== characterId),
            updatedAt,
          )
        : current,
    thread,
  );
}

/** Clear a persona reference from every branch, including inactive branches. */
export function clearModeThreadPersona<K extends ModeThreadKind>(
  thread: ModeThreadOfKind<K>,
  personaId: string,
  updatedAt: string,
): ModeThreadOfKind<K> {
  return thread.branches.reduce(
    (current, branch) =>
      branch.activePersonaId === personaId
        ? setModeBranchPersona(current, branch.id, null, updatedAt)
        : current,
    thread,
  );
}

/** Remove a lorebook reference from every branch, including inactive branches. */
export function removeModeThreadLorebook<K extends ModeThreadKind>(
  thread: ModeThreadOfKind<K>,
  lorebookId: string,
  updatedAt: string,
): ModeThreadOfKind<K> {
  return thread.branches.reduce(
    (current, branch) =>
      branch.lorebookIds.includes(lorebookId)
        ? setModeBranchLorebooks(
            current,
            branch.id,
            branch.lorebookIds.filter((id) => id !== lorebookId),
            updatedAt,
          )
        : current,
    thread,
  );
}

/** Replace a provider connection reference from every branch, including inactive branches. */
export function replaceModeThreadProviderConnection<K extends ModeThreadKind>(
  thread: ModeThreadOfKind<K>,
  deletedConnectionId: string,
  fallbackConnectionId: string | null,
  updatedAt: string,
): ModeThreadOfKind<K> {
  return thread.branches.reduce(
    (current, branch) =>
      branch.providerConnectionId === deletedConnectionId
        ? setModeBranchProviderConnection(current, branch.id, fallbackConnectionId, updatedAt)
        : current,
    thread,
  );
}

export function setModeBranchSystemPrompt<K extends ModeThreadKind>(
  thread: ModeThreadOfKind<K>,
  branchId: string,
  systemPromptMode: "default" | "custom",
  systemPrompt: string,
  updatedAt: string,
): ModeThreadOfKind<K> {
  return updateBranch(thread, branchId, (branch) => ({
    ...branch,
    systemPromptMode,
    systemPrompt: systemPromptMode === "custom" ? systemPrompt.trim() : "",
    updatedAt: branchUpdateTimestamp(branch, updatedAt),
  }));
}

export function getModeThreadActivityAt(thread: ModeThread): string {
  assertValidModeThread(thread);
  const latestTimestamp = (latest: string, candidate: string): string =>
    Date.parse(candidate) > Date.parse(latest) ? candidate : latest;

  let latest = thread.updatedAt;
  for (const branch of thread.branches) latest = latestTimestamp(latest, branch.updatedAt);
  for (const message of thread.messages) {
    latest = latestTimestamp(latest, message.updatedAt);
    for (const version of message.versions) latest = latestTimestamp(latest, version.updatedAt);
  }
  return latest;
}
