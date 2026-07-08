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
import {
  resolvePromptPresetMessengerPrompt,
  type PromptPresetRecord,
} from "../contracts/types/prompt-presets";
import type { ProviderConnectionRecord } from "../contracts/types/provider-connection";
import {
  activateLoreGenerationEntriesWithWarnings,
  characterGenerationContext,
  cleanGenerationText,
  createGenerationMacroContext,
  createGenerationRequestAssemblyResult,
  finalizeLoreGenerationRuntimeState,
  formatLoreGenerationEntries,
  injectAtDepth,
  namedGenerationBlock,
  personaGenerationContext,
  resolveGenerationMacros,
  resolveGenerationRecords,
  type GenerationMacroContext,
  type GenerationPromptAssemblyResult,
  type GenerationRequestEnvelope,
  type GenerationRequestAssemblyResult,
  type MacroVariableMutation,
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

export interface MessengerGenerationRequest extends GenerationRequestEnvelope<MessengerThread> {
  userMessage: MessengerMessage;
}

export type MessengerGenerationResponse = GenerationResponse;

export type MessengerGenerationAdapter = GenerationAdapter<MessengerGenerationRequest>;

export type MessengerGenerationRequestAssembly =
  GenerationRequestAssemblyResult<MessengerGenerationRequest>;

export interface MessengerGenerationContext {
  activePersona: PersonaRecord | null;
  companions: CharacterRecord[];
  lorebooks: LorebookRecord[];
  lorebookSources: LorebookSourceBuckets;
  loreInsertionStrategy: LoreInsertionStrategy;
  providerConnectionId: string | null;
  providerConnection: ProviderConnectionRecord | null;
  promptPreset: PromptPresetRecord | null;
  requestThread: MessengerThread;
  variables: Record<string, string>;
  warnings: string[];
}

export interface MessengerGenerationContextInput {
  thread: MessengerThread;
  characters: CharacterRecord[];
  personas: PersonaRecord[];
  lorebooks: LorebookRecord[];
  promptPresets?: PromptPresetRecord[];
  appSettings?: Pick<AppSettings, "globalLorebookIds" | "loreInsertionStrategy"> | null;
  providerConnections?: ProviderConnectionRecord[];
  fallbackProviderConnectionId?: string | null;
  variables?: Record<string, string>;
}

export function createMessengerGenerationContext({
  appSettings = null,
  characters,
  fallbackProviderConnectionId = null,
  lorebooks,
  personas,
  promptPresets = [],
  providerConnections = [],
  thread,
  variables = {},
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
    promptPresetId: thread.presetId,
    promptPresets,
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
    promptPreset: records.promptPreset,
    variables,
    requestThread: {
      ...thread,
      activePersonaId: records.activePersona?.id ?? null,
      characterIds: records.companions.map((companion) => companion.id),
      lorebookIds: records.lorebookSources.chat.map((lorebook) => lorebook.id),
      presetId: records.promptPreset?.id ?? null,
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
  selectedPrompt,
  targetCompanion,
}: {
  activePersona: PersonaRecord | null;
  activatedLoreEntries: ActivatedLoreEntry[];
  companions: CharacterRecord[];
  macroContext: GenerationMacroContext;
  selectedPrompt: string;
  targetCompanion: CharacterRecord | null;
}) {
  return [
    selectedPrompt,
    ...namedGenerationBlock(
      "Selected lore",
      formatLoreGenerationEntries(
        activatedLoreEntries.filter(
          (entry) => entry.entry.insertionPosition === "before-character",
        ),
        { macroContext },
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
        { macroContext },
      ),
    ),
    ...postHistoryInstructionBlock(
      "Post-history instructions",
      targetCompanion?.postHistoryInstructions,
      macroContext,
    ),
    ...postHistoryInstructionBlock(
      "Persona post-history instructions",
      activePersona?.postHistoryInstructions,
      macroContext,
    ),
  ].join("\n\n");
}

function postHistoryInstructionBlock(
  label: string,
  value: string | null | undefined,
  macroContext: GenerationMacroContext,
) {
  if (!value) return [];

  const resolved = resolveGenerationMacros(value, macroContext).trim();
  return resolved ? [`${label}\n${resolved}`] : [];
}

function createMessengerPromptAssembly({
  activePersona,
  companions,
  lorebookSources,
  loreInsertionStrategy,
  loreRuntimeState,
  now,
  providerConnection,
  promptPreset,
  thread,
  targetCompanion,
  timeZone,
  userMessage,
  variables,
}: {
  activePersona: PersonaRecord | null;
  companions: CharacterRecord[];
  lorebookSources: LorebookSourceBuckets;
  loreInsertionStrategy: LoreInsertionStrategy;
  loreRuntimeState?: LoreRuntimeState | null;
  now: string;
  providerConnection: ProviderConnectionRecord | null;
  promptPreset: PromptPresetRecord | null;
  thread: MessengerThread;
  targetCompanion: CharacterRecord | null;
  timeZone?: string | null;
  userMessage: MessengerMessage;
  variables?: Record<string, string>;
}): GenerationPromptAssemblyResult {
  const macroVariableMutations: MacroVariableMutation[] = [];
  const macroContext = createGenerationMacroContext({
    activePersona,
    companions,
    lastInput: userMessage.body,
    now,
    providerConnection,
    targetCompanion,
    threadId: thread.id,
    timeZone,
    variables,
    variableMutations: macroVariableMutations,
  });
  const selectedPrompt = resolveGenerationMacros(
    resolveMessengerSystemPrompt(thread, resolvePromptPresetMessengerPrompt(promptPreset)),
    macroContext,
  );
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
  const systemPrompt = buildSystemPrompt({
    activePersona,
    activatedLoreEntries,
    companions,
    macroContext,
    selectedPrompt,
    targetCompanion,
  });
  const transcriptWithDepthLore = injectAtDepth(
    transcript,
    activatedLoreEntries.filter((entry) => entry.entry.insertionPosition === "at-depth"),
    { macroContext, providerConnection },
  );
  const finalLoreRuntimeState = finalizeLoreGenerationRuntimeState(loreActivation);

  return {
    loreRuntimeState: finalLoreRuntimeState,
    macroVariableMutations,
    promptMessages: [
      {
        role: "system",
        content: systemPrompt,
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
  timeZone,
  userMessage,
}: {
  context: MessengerGenerationContext;
  id: string;
  loreRuntimeState?: LoreRuntimeState | null;
  now: string;
  parameters?: Partial<MessengerGenerationParameters>;
  /** IANA time zone for display macros; omitted or `null` uses UTC. */
  timeZone?: string | null;
  userMessage: MessengerMessage;
}): MessengerGenerationRequest {
  return createMessengerGenerationRequestAssembly({
    context,
    id,
    loreRuntimeState,
    now,
    parameters,
    timeZone,
    userMessage,
  }).request;
}

export function createMessengerGenerationRequestAssembly({
  context,
  id,
  loreRuntimeState,
  now,
  parameters,
  timeZone,
  userMessage,
}: {
  context: MessengerGenerationContext;
  id: string;
  loreRuntimeState?: LoreRuntimeState | null;
  now: string;
  parameters?: Partial<MessengerGenerationParameters>;
  /** IANA time zone for display macros; omitted or `null` uses UTC. */
  timeZone?: string | null;
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
    promptPreset: context.promptPreset,
    thread: context.requestThread,
    targetCompanion,
    timeZone,
    userMessage,
    variables: context.variables,
  });

  return createGenerationRequestAssemblyResult<MessengerThread, MessengerGenerationRequest>({
    context,
    createRequest: (request) => ({ ...request, userMessage }),
    id,
    now,
    parameters,
    promptAssembly,
    targetCompanion,
    thread: context.requestThread,
  });
}
