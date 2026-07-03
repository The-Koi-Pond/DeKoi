import type { CharacterRecord } from "../contracts/types/character";
import type { LorebookRecord } from "../contracts/types/lorebook";
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
  createGenerationParameters,
  formatLoreGenerationEntries,
  injectAtDepth,
  namedGenerationBlock,
  personaGenerationContext,
  replaceGenerationPromptMacros,
  resolveGenerationRecords,
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

export interface MessengerGenerationContext {
  activePersona: PersonaRecord | null;
  companions: CharacterRecord[];
  lorebooks: LorebookRecord[];
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
  providerConnections?: ProviderConnectionRecord[];
  fallbackProviderConnectionId?: string | null;
}

export function createMessengerGenerationContext({
  characters,
  fallbackProviderConnectionId = null,
  lorebooks,
  personas,
  providerConnections = [],
  thread,
}: MessengerGenerationContextInput): MessengerGenerationContext {
  const records = resolveGenerationRecords({
    activePersonaId: thread.activePersonaId,
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
    providerConnectionId: records.providerConnectionId,
    providerConnection: records.providerConnection,
    requestThread: {
      ...thread,
      activePersonaId: records.activePersona?.id ?? null,
      characterIds: records.companions.map((companion) => companion.id),
      lorebookIds: records.lorebooks.map((lorebook) => lorebook.id),
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
  targetCompanion,
  thread,
}: {
  activePersona: PersonaRecord | null;
  activatedLoreEntries: ActivatedLoreEntry[];
  companions: CharacterRecord[];
  targetCompanion: CharacterRecord | null;
  thread: MessengerThread;
}) {
  const targetName = targetCompanion?.displayName ?? "the selected companion";
  const userName = activePersona?.displayName ?? "the user";
  const selectedPrompt = replaceGenerationPromptMacros(
    resolveMessengerSystemPrompt(thread),
    targetName,
    userName,
  );

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
      activePersona ? personaGenerationContext(activePersona) : ["Anonymous user"],
    ),
    ...companions.flatMap((companion) =>
      namedGenerationBlock(
        companion.id === targetCompanion?.id ? "Replying companion" : "Other companion",
        characterGenerationContext(companion),
      ),
    ),
    ...namedGenerationBlock(
      "Selected lore",
      formatLoreGenerationEntries(
        activatedLoreEntries.filter((entry) => entry.entry.insertionPosition === "after-character"),
      ),
    ),
    ...(targetCompanion?.postHistoryInstructions
      ? [`Post-history instructions\n${targetCompanion.postHistoryInstructions}`]
      : []),
    ...(activePersona?.postHistoryInstructions
      ? [`Persona post-history instructions\n${activePersona.postHistoryInstructions}`]
      : []),
  ].join("\n\n");
}

function createMessengerPromptAssembly({
  activePersona,
  companions,
  lorebooks,
  providerConnection,
  thread,
  targetCompanion,
}: {
  activePersona: PersonaRecord | null;
  companions: CharacterRecord[];
  lorebooks: LorebookRecord[];
  providerConnection: ProviderConnectionRecord | null;
  thread: MessengerThread;
  targetCompanion: CharacterRecord | null;
}): {
  promptMessages: MessengerGenerationPromptMessage[];
  warnings: string[];
} {
  const loreActivation = activateLoreGenerationEntriesWithWarnings(lorebooks, {
    activePersona,
    companions,
    contextTokens: providerConnection?.maxContext ?? null,
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
    promptMessages: [
      {
        role: "system",
        content: buildSystemPrompt({
          activePersona,
          activatedLoreEntries,
          companions,
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
  now,
  parameters,
  userMessage,
}: {
  context: MessengerGenerationContext;
  id: string;
  now: string;
  parameters?: Partial<MessengerGenerationParameters>;
  userMessage: MessengerMessage;
}): MessengerGenerationRequest {
  const targetCompanion = getNextMessengerCompanion(context.requestThread, context.companions);
  const promptAssembly = createMessengerPromptAssembly({
    activePersona: context.activePersona,
    companions: context.companions,
    lorebooks: context.lorebooks,
    providerConnection: context.providerConnection,
    thread: context.requestThread,
    targetCompanion,
  });

  return {
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
  };
}
