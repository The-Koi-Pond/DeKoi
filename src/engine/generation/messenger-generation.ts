import type { CharacterRecord } from "../contracts/types/character";
import type { LorebookRecord, LoreInsertionStrategy } from "../contracts/types/lorebook";
import type { LoreRuntimeState } from "../contracts/types/lore-runtime-state";
import type { AppSettings } from "../contracts/types/app-settings";
import {
  resolveMessengerSystemPrompt,
  type MessengerMessage,
  type MessengerThread,
} from "../contracts/types/messenger";
import type {
  ActivatedLoreEntry,
  LorebookScanSource,
} from "../generation-core/lorebook-activation";
import { getNextMessengerCompanion } from "../modes/messenger/messenger-actions";
import type { PersonaRecord } from "../contracts/types/persona";
import type { ProviderConnectionRecord } from "../contracts/types/provider-connection";
import {
  activateLoreGenerationEntriesWithWarnings,
  characterGenerationContext,
  cleanGenerationText,
  createGenerationMacroContext,
  createGenerationParameters,
  formatLoreGenerationEntries,
  injectAtDepth,
  namedGenerationBlock,
  personaGenerationContext,
  resolveGenerationMacros,
  resolveGenerationRecords,
  type GenerationMacroContext,
  type LorebookSourceBuckets,
} from "./generation";
import type {
  GenerationAdapter,
  GenerationParameters,
  GenerationPromptMessage,
  GenerationResponse,
} from "./generation";

type MessengerGenerationPromptMessage = GenerationPromptMessage;
export type MessengerGenerationParameters = GenerationParameters;

export interface MessengerGenerationRequest {
  schemaVersion: 1;
  id: string;
  createdAt: string;
  thread: MessengerThread;
  userMessage: MessengerMessage;
  companions: CharacterRecord[];
  activePersona: PersonaRecord | null;
  lorebooks: LorebookRecord[];
  providerConnectionId: string | null;
  providerConnection: ProviderConnectionRecord | null;
  targetCharacterId: string | null;
  targetCharacterName: string | null;
  promptMessages: MessengerGenerationPromptMessage[];
  parameters: MessengerGenerationParameters;
  /**
   * Non-fatal app-side context or activation warnings to surface after generation.
   */
  warnings: string[];
}

export type MessengerGenerationResponse = GenerationResponse;

export type MessengerGenerationAdapter = GenerationAdapter<MessengerGenerationRequest>;

export interface MessengerGenerationRequestAssembly {
  request: MessengerGenerationRequest;
  loreRuntimeState: LoreRuntimeState | null;
}

export interface MessengerGenerationContext {
  activePersona: PersonaRecord | null;
  companions: CharacterRecord[];
  lorebooks: LorebookRecord[];
  lorebookSources: LorebookSourceBuckets;
  loreInsertionStrategy: LoreInsertionStrategy;
  providerConnectionId: string | null;
  providerConnection: ProviderConnectionRecord | null;
  requestThread: MessengerThread;
  warnings: string[];
}

export interface MessengerGenerationContextInput {
  thread: MessengerThread;
  characters: CharacterRecord[];
  personas: PersonaRecord[];
  lorebooks: LorebookRecord[];
  appSettings?: Pick<AppSettings, "globalLorebookIds" | "loreInsertionStrategy"> | null;
  providerConnections?: ProviderConnectionRecord[];
  fallbackProviderConnectionId?: string | null;
}

export function createMessengerGenerationContext({
  appSettings = null,
  characters,
  fallbackProviderConnectionId = null,
  lorebooks,
  personas,
  providerConnections = [],
  thread,
}: MessengerGenerationContextInput): MessengerGenerationContext {
  const records = resolveGenerationRecords({
    activePersonaId: thread.activePersonaId,
    appSettings,
    characterIds: thread.characterIds,
    characters,
    fallbackProviderConnectionId,
    lorebookIds: thread.lorebookIds,
    lorebooks,
    personas,
    providerConnectionId: thread.providerConnectionId,
    providerConnections,
    warningPrefix: "Messenger thread",
  });

  return {
    activePersona: records.activePersona,
    companions: records.companions,
    lorebooks: records.lorebooks,
    lorebookSources: records.lorebookSources,
    loreInsertionStrategy: records.loreInsertionStrategy,
    providerConnectionId: records.providerConnectionId,
    providerConnection: records.providerConnection,
    requestThread: {
      ...thread,
      activePersonaId: records.activePersona?.id ?? null,
      characterIds: records.companions.map((companion) => companion.id),
      lorebookIds: records.lorebookSources.chat.map((lorebook) => lorebook.id),
      mode: records.companions.length > 1 ? "group" : "direct",
      providerConnectionId: records.providerConnectionId,
    },
    warnings: records.warnings,
  };
}

function messageRole(message: MessengerMessage): MessengerGenerationPromptMessage["role"] {
  return message.author.kind === "character" ? "assistant" : "user";
}

function messageContent(message: MessengerMessage) {
  const label = cleanGenerationText(message.author.label) || "Unknown";
  return `${label}: ${message.body.trim()}`;
}

function messengerLoreScanSources(thread: MessengerThread): LorebookScanSource[] {
  return thread.messages.map((message) => ({
    name: cleanGenerationText(message.author.label) || null,
    body: message.body,
  }));
}

function buildSystemPrompt({
  activePersona,
  activatedLoreEntries,
  companions,
  macroContext,
  targetCompanion,
  thread,
}: {
  activePersona: PersonaRecord | null;
  activatedLoreEntries: ActivatedLoreEntry[];
  companions: CharacterRecord[];
  macroContext: GenerationMacroContext;
  targetCompanion: CharacterRecord | null;
  thread: MessengerThread;
}) {
  const selectedPrompt = resolveGenerationMacros(
    resolveMessengerSystemPrompt(thread),
    macroContext,
  );
  const targetPostHistoryInstructions = targetCompanion?.postHistoryInstructions
    ? resolveGenerationMacros(targetCompanion.postHistoryInstructions, macroContext)
    : "";
  const personaPostHistoryInstructions = activePersona?.postHistoryInstructions
    ? resolveGenerationMacros(activePersona.postHistoryInstructions, macroContext)
    : "";

  return [
    selectedPrompt,
    ...namedGenerationBlock(
      "Selected lore",
      formatLoreGenerationEntries(
        activatedLoreEntries.filter(
          (entry) => entry.entry.insertionPosition === "before-character",
        ),
      ),
    ),
    ...namedGenerationBlock(
      "Active persona",
      activePersona
        ? personaGenerationContext(activePersona, "System prompt", { macroContext })
        : ["Anonymous user"],
    ),
    ...companions.flatMap((companion) =>
      namedGenerationBlock(
        companion.id === targetCompanion?.id ? "Replying companion" : "Other companion",
        characterGenerationContext(companion, { macroContext }),
      ),
    ),
    ...namedGenerationBlock(
      "Selected lore",
      formatLoreGenerationEntries(
        activatedLoreEntries.filter((entry) => entry.entry.insertionPosition === "after-character"),
      ),
    ),
    ...(targetPostHistoryInstructions.trim()
      ? [`Post-history instructions\n${targetPostHistoryInstructions}`]
      : []),
    ...(personaPostHistoryInstructions.trim()
      ? [`Persona post-history instructions\n${personaPostHistoryInstructions}`]
      : []),
  ].join("\n\n");
}

function createMessengerPromptAssembly({
  activePersona,
  companions,
  lorebookSources,
  loreInsertionStrategy,
  loreRuntimeState,
  now,
  providerConnection,
  thread,
  targetCompanion,
  userMessage,
}: {
  activePersona: PersonaRecord | null;
  companions: CharacterRecord[];
  lorebookSources: LorebookSourceBuckets;
  loreInsertionStrategy: LoreInsertionStrategy;
  loreRuntimeState?: LoreRuntimeState | null;
  now: string;
  providerConnection: ProviderConnectionRecord | null;
  thread: MessengerThread;
  targetCompanion: CharacterRecord | null;
  userMessage: MessengerMessage;
}): {
  loreRuntimeState: LoreRuntimeState | null;
  promptMessages: MessengerGenerationPromptMessage[];
  warnings: string[];
} {
  const macroContext = createGenerationMacroContext({
    activePersona,
    companions,
    lastInput: userMessage.body,
    now,
    providerConnection,
    targetCompanion,
    threadId: thread.id,
  });
  const loreActivation = activateLoreGenerationEntriesWithWarnings(lorebookSources, {
    activePersona,
    companions,
    contextTokens: providerConnection?.maxContext ?? null,
    insertionStrategy: loreInsertionStrategy,
    macroContext,
    runtimeState: loreRuntimeState,
    scanSources: messengerLoreScanSources(thread),
  });
  const activatedLoreEntries = loreActivation.entries;
  const transcript = thread.messages
    .filter((message) => message.body.trim())
    .map((message) => ({
      role: messageRole(message),
      content: messageContent(message),
    }));
  const transcriptWithDepthLore = injectAtDepth(
    transcript,
    activatedLoreEntries.filter((entry) => entry.entry.insertionPosition === "at-depth"),
    { providerConnection },
  );

  return {
    loreRuntimeState: loreActivation.runtimeState,
    promptMessages: [
      {
        role: "system",
        content: buildSystemPrompt({
          activePersona,
          activatedLoreEntries,
          companions,
          macroContext,
          targetCompanion,
          thread,
        }),
      },
      ...transcriptWithDepthLore,
    ],
    warnings: loreActivation.warnings,
  };
}

export function createMessengerGenerationRequest({
  context,
  id,
  loreRuntimeState,
  now,
  parameters,
  userMessage,
}: {
  context: MessengerGenerationContext;
  id: string;
  loreRuntimeState?: LoreRuntimeState | null;
  now: string;
  parameters?: Partial<MessengerGenerationParameters>;
  userMessage: MessengerMessage;
}): MessengerGenerationRequest {
  return createMessengerGenerationRequestAssembly({
    context,
    id,
    loreRuntimeState,
    now,
    parameters,
    userMessage,
  }).request;
}

export function createMessengerGenerationRequestAssembly({
  context,
  id,
  loreRuntimeState,
  now,
  parameters,
  userMessage,
}: {
  context: MessengerGenerationContext;
  id: string;
  loreRuntimeState?: LoreRuntimeState | null;
  now: string;
  parameters?: Partial<MessengerGenerationParameters>;
  userMessage: MessengerMessage;
}): MessengerGenerationRequestAssembly {
  const targetCompanion = getNextMessengerCompanion(context.requestThread, context.companions);
  const promptAssembly = createMessengerPromptAssembly({
    activePersona: context.activePersona,
    companions: context.companions,
    lorebookSources: context.lorebookSources,
    loreInsertionStrategy: context.loreInsertionStrategy,
    loreRuntimeState,
    now,
    providerConnection: context.providerConnection,
    thread: context.requestThread,
    targetCompanion,
    userMessage,
  });

  return {
    request: {
      schemaVersion: 1,
      id,
      createdAt: now,
      thread: context.requestThread,
      userMessage,
      companions: context.companions,
      activePersona: context.activePersona,
      lorebooks: context.lorebooks,
      providerConnectionId: context.providerConnectionId,
      providerConnection: context.providerConnection,
      targetCharacterId: targetCompanion?.id ?? null,
      targetCharacterName: targetCompanion?.displayName ?? null,
      promptMessages: promptAssembly.promptMessages,
      parameters: createGenerationParameters(parameters, context.providerConnection),
      warnings: [...context.warnings, ...promptAssembly.warnings],
    },
    loreRuntimeState: promptAssembly.loreRuntimeState,
  };
}
