import type { CharacterRecord } from "../contracts/types/character";
import type { LorebookRecord, LoreInsertionStrategy } from "../contracts/types/lorebook";
import type { LoreRuntimeState } from "../contracts/types/lore-runtime-state";
import type { AppSettings } from "../contracts/types/app-settings";
import type { MessengerModeThread, ModeMessage } from "../contracts/types/mode-thread";
import { DEFAULT_MESSENGER_SYSTEM_PROMPT } from "../contracts/types/messenger";
import {
  createActiveModeThreadSnapshot,
  getActiveModeBranch,
  getActiveModeBranchMessages,
  getActiveModeMessageVersion,
} from "../modes/mode-thread/mode-thread-actions";
import type { ActivatedLoreEntry } from "../generation-core/lorebook-activation";
import type { LorebookScanSource } from "../generation-core/lorebook-matching";
import { getNextMessengerCompanion } from "../modes/messenger/messenger-actions";
import type { PersonaRecord } from "../contracts/types/persona";
import type { PromptPresetRecord } from "../contracts/types/prompt-presets";
import { resolvePromptPresetChoiceVariables } from "../prompt-presets/prompt-preset-normalization";
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
  resolveGenerationMacroVariableValues,
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

export interface MessengerGenerationRequest extends GenerationRequestEnvelope<MessengerModeThread> {
  userMessage: ModeMessage;
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
  requestThread: MessengerModeThread;
  ephemeralVariableNames: string[];
  variables: Record<string, string>;
  warnings: string[];
}

export interface MessengerGenerationContextInput {
  thread: MessengerModeThread;
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
  const branch = getActiveModeBranch(thread);
  const records = resolveGenerationRecords({
    activePersonaId: branch.activePersonaId,
    appSettings,
    characterIds: branch.characterIds,
    characters,
    fallbackProviderConnectionId,
    lorebookIds: branch.lorebookIds,
    lorebooks,
    personas,
    promptPresetId: branch.presetId,
    promptPresets,
    providerConnectionId: branch.providerConnectionId,
    providerConnections,
    warningPrefix: "Messenger thread",
  });
  const resolvedPresetId = records.promptPreset?.id ?? null;
  const presetChoiceVariables = resolvePromptPresetChoiceVariables({
    preset: records.promptPreset,
    selections: resolvedPresetId ? branch.presetChoiceSelectionsByPresetId[resolvedPresetId] : {},
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
    ephemeralVariableNames: presetChoiceVariables.variableNames,
    variables: {
      ...variables,
      ...presetChoiceVariables.variables,
    },
    requestThread: {
      ...createActiveModeThreadSnapshot(thread),
      branches: [
        {
          ...branch,
          activePersonaId: records.activePersona?.id ?? null,
          characterIds: records.companions.map((c) => c.id),
          lorebookIds: records.lorebookSources.chat.map((l) => l.id),
          presetId: resolvedPresetId,
          providerConnectionId: records.providerConnectionId,
          presetChoiceSelectionsByPresetId: resolvedPresetId
            ? {
                [resolvedPresetId]: branch.presetChoiceSelectionsByPresetId[resolvedPresetId] ?? {},
              }
            : {},
        },
      ],
    },
    warnings: records.warnings,
  };
}

function messageRole(message: ModeMessage): MessengerGenerationPromptMessage["role"] {
  return message.author.kind === "character" ? "assistant" : "user";
}

function messageContent(message: ModeMessage) {
  const body = getActiveModeMessageVersion(message).body;
  const label = cleanGenerationText(message.author.label) || "Unknown";
  return `${label}: ${body.trim()}`;
}

function messengerLoreScanSources(thread: MessengerModeThread): LorebookScanSource[] {
  return getActiveModeBranchMessages(thread).map((message) => ({
    name: cleanGenerationText(message.author.label) || null,
    body: getActiveModeMessageVersion(message).body,
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
  variableNames,
}: {
  activePersona: PersonaRecord | null;
  companions: CharacterRecord[];
  lorebookSources: LorebookSourceBuckets;
  loreInsertionStrategy: LoreInsertionStrategy;
  loreRuntimeState?: LoreRuntimeState | null;
  now: string;
  providerConnection: ProviderConnectionRecord | null;
  promptPreset: PromptPresetRecord | null;
  thread: MessengerModeThread;
  targetCompanion: CharacterRecord | null;
  timeZone?: string | null;
  userMessage: ModeMessage;
  variables?: Record<string, string>;
  variableNames?: string[];
}): GenerationPromptAssemblyResult {
  if (
    loreRuntimeState &&
    (loreRuntimeState.ownerKind !== "mode-branch" ||
      loreRuntimeState.ownerId !== getActiveModeBranch(thread).id)
  ) {
    throw new Error("Invalid Messenger lore runtime state owner");
  }
  const macroVariableMutations: MacroVariableMutation[] = [];
  const macroContext = createGenerationMacroContext({
    activePersona,
    companions,
    lastInput: getActiveModeMessageVersion(userMessage).body,
    now,
    providerConnection,
    targetCompanion,
    threadId: thread.id,
    timeZone,
    variables,
    variableMutations: macroVariableMutations,
  });
  resolveGenerationMacroVariableValues(macroContext, variableNames ?? []);
  const selectedPrompt = resolveGenerationMacros(
    promptPreset?.messengerPrompt.trim() || DEFAULT_MESSENGER_SYSTEM_PROMPT,
    macroContext,
  );
  const loreActivation = activateLoreGenerationEntriesWithWarnings(lorebookSources, {
    activePersona,
    companions,
    contextTokens: providerConnection?.maxContext ?? null,
    generationTrigger: "normal",
    insertionStrategy: loreInsertionStrategy,
    macroContext,
    runtimeState: loreRuntimeState,
    scanSources: messengerLoreScanSources(thread),
    targetCharacterId: targetCompanion?.id ?? null,
  });
  const activatedLoreEntries = loreActivation.entries;
  const transcript = getActiveModeBranchMessages(thread)
    .filter((message) => getActiveModeMessageVersion(message).body.trim())
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
  const promptMessages = [
    {
      role: "system" as const,
      content: systemPrompt,
    },
    ...transcriptWithDepthLore,
  ];
  const finalLoreRuntimeState = finalizeLoreGenerationRuntimeState(loreActivation);

  return {
    loreRuntimeState: finalLoreRuntimeState,
    macroVariableMutations,
    promptMessages,
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
  userMessage: ModeMessage;
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
  userMessage: ModeMessage;
}): MessengerGenerationRequestAssembly {
  const activeBranch = getActiveModeBranch(context.requestThread);
  if (userMessage.threadId !== context.requestThread.id) {
    throw new Error("Invalid Messenger user message: foreign thread");
  }
  if (userMessage.branchId !== activeBranch.id) {
    throw new Error("Invalid Messenger user message: inactive branch");
  }
  const canonicalMessage = context.requestThread.messages.find(
    (message) =>
      message.id === userMessage.id &&
      message.threadId === context.requestThread.id &&
      message.branchId === activeBranch.id,
  );
  if (!canonicalMessage) {
    throw new Error("Invalid Messenger user message: missing from active branch");
  }
  const projectedUserMessage: ModeMessage = {
    ...canonicalMessage,
    versions: [getActiveModeMessageVersion(canonicalMessage)],
  };
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
    userMessage: projectedUserMessage,
    variables: context.variables,
    variableNames: context.ephemeralVariableNames,
  });

  return createGenerationRequestAssemblyResult<MessengerModeThread, MessengerGenerationRequest>({
    context,
    createRequest: (request) => ({ ...request, userMessage: projectedUserMessage }),
    id,
    now,
    parameters,
    promptAssembly,
    targetCompanion,
    thread: createActiveModeThreadSnapshot(context.requestThread),
  });
}
