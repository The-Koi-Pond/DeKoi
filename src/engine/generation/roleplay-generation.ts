import type { CharacterRecord } from "../contracts/types/character";
import type { LorebookRecord, LoreInsertionStrategy } from "../contracts/types/lorebook";
import type { LoreRuntimeState } from "../contracts/types/lore-runtime-state";
import type { AppSettings } from "../contracts/types/app-settings";
import type { PersonaRecord } from "../contracts/types/persona";
import type { PromptPresetRecord } from "../contracts/types/prompt-presets";
import { resolvePromptPresetChoiceVariables } from "../prompt-presets/prompt-preset-normalization";
import type { ProviderConnectionRecord } from "../contracts/types/provider-connection";
import type { RoleplayModeThread, ModeMessage } from "../contracts/types/mode-thread";
import {
  createActiveModeThreadSnapshot,
  getActiveModeBranch,
  getActiveModeBranchMessages,
  getActiveModeMessageVersion,
} from "../modes/mode-thread/mode-thread-actions";
import { getNextRoleplayCompanion } from "../modes/roleplay/roleplay-actions";
import { assemblePromptPresetMessages } from "../prompt-presets/prompt-preset-assembler";
import type {
  ActivatedLoreEntry,
  LorebookScanSource,
} from "../generation-core/lorebook-activation";
import {
  activateLoreGenerationEntriesWithWarnings,
  characterGenerationContext,
  cleanGenerationText,
  createGenerationMacroContext,
  createGenerationRequestAssemblyResult,
  exampleDialogueGenerationContext,
  finalizeLoreGenerationRuntimeState,
  formatLoreGenerationEntries,
  injectAtDepth,
  namedGenerationBlock,
  personaGenerationContext,
  resolveGenerationMacros,
  resolveGenerationMacroVariableValues,
  resolveGenerationRecords,
  settleUnrenderedLoreGenerationEntries,
  type GenerationMacroContext,
  type GenerationPromptAssemblyResult,
  type GenerationRequestEnvelope,
  type GenerationRequestAssemblyResult,
  type MacroVariableMutation,
  type LorebookSourceBuckets,
} from "./generation";
import type {
  GenerationParameters,
  GenerationPromptMessage,
  GenerationResponse,
} from "./generation";

const DEFAULT_ROLEPLAY_SYSTEM_PROMPT = `<role>
You are {{char}}, writing the next in-character turn in an ongoing fictional roleplay with {{user}}.
Treat the conversation as a continuous scene, not a chat with an assistant.
</role>

<rules>
Here are the rules for the interaction:
- Stay in character based on your description, personality, scenario, memories, lore, and relationship with {{user}}.
- Continue naturally from the latest message. Do not recap the scene unless {{char}} would naturally do that.
- Write only {{char}}'s next reply or action. Do not write {{user}}'s response.
- Preserve the established writing style, tense, formatting, and message length from the existing thread.
- Dialogue, narration, and actions are allowed when they fit the scene.
- Do not describe yourself as an AI, assistant, narrator, model, or writing partner.
- Do not include timestamps, dates, brackets, speaker labels, markdown fences, or metadata in your reply.
- Your output must contain only {{char}}'s natural next turn.
</rules>`;

type RoleplayGenerationPromptMessage = GenerationPromptMessage;
export type RoleplayGenerationParameters = GenerationParameters;
export type RoleplayGenerationResponse = GenerationResponse;

export type RoleplayGenerationRequest = GenerationRequestEnvelope<RoleplayModeThread>;

export type RoleplayGenerationRequestAssembly =
  GenerationRequestAssemblyResult<RoleplayGenerationRequest>;

export interface RoleplayGenerationContext {
  activePersona: PersonaRecord | null;
  companions: CharacterRecord[];
  lorebooks: LorebookRecord[];
  lorebookSources: LorebookSourceBuckets;
  loreInsertionStrategy: LoreInsertionStrategy;
  providerConnectionId: string | null;
  providerConnection: ProviderConnectionRecord | null;
  promptPreset: PromptPresetRecord | null;
  requestThread: RoleplayModeThread;
  ephemeralVariableNames: string[];
  variables: Record<string, string>;
  warnings: string[];
}

export interface RoleplayGenerationContextInput {
  thread: RoleplayModeThread;
  characters: CharacterRecord[];
  personas: PersonaRecord[];
  lorebooks: LorebookRecord[];
  promptPresets?: PromptPresetRecord[];
  appSettings?: Pick<AppSettings, "globalLorebookIds" | "loreInsertionStrategy"> | null;
  providerConnections?: ProviderConnectionRecord[];
  fallbackProviderConnectionId?: string | null;
  variables?: Record<string, string>;
}

function roleplayMessageRole(message: ModeMessage): RoleplayGenerationPromptMessage["role"] {
  return message.author.kind === "character"
    ? "assistant"
    : message.author.kind === "system"
      ? "system"
      : "user";
}

function roleplayMessageContent(message: ModeMessage) {
  const label = cleanGenerationText(message.author.label) || "Unknown";
  return `${label}: ${getActiveModeMessageVersion(message).body.trim()}`;
}

function roleplayLoreScanSources(thread: RoleplayModeThread): LorebookScanSource[] {
  return getActiveModeBranchMessages(thread).map((message) => ({
    name: cleanGenerationText(message.author.label) || null,
    body: getActiveModeMessageVersion(message).body,
  }));
}

function latestRoleplayInput(thread: RoleplayModeThread) {
  const messages = getActiveModeBranchMessages(thread);
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const body = getActiveModeMessageVersion(messages[index]).body;
    if (body.trim()) return body;
  }

  return null;
}

export function createRoleplayGenerationContext({
  appSettings = null,
  characters,
  fallbackProviderConnectionId = null,
  lorebooks,
  personas,
  promptPresets = [],
  providerConnections = [],
  thread,
  variables = {},
}: RoleplayGenerationContextInput): RoleplayGenerationContext {
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
    warningPrefix: "Roleplay thread",
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

function buildRoleplaySystemPrompt({
  activePersona,
  activatedLoreEntries,
  companions,
  macroContext,
  prelude,
  summarizedLorebookIds,
  targetCompanion,
}: {
  activePersona: PersonaRecord | null;
  activatedLoreEntries: ActivatedLoreEntry[];
  companions: CharacterRecord[];
  macroContext: GenerationMacroContext;
  prelude: {
    sceneLines: string[];
    selectedPrompt: string;
  };
  summarizedLorebookIds: Set<string>;
  targetCompanion: CharacterRecord | null;
}) {
  return [
    prelude.selectedPrompt,
    ...namedGenerationBlock("Scene", prelude.sceneLines),
    ...namedGenerationBlock(
      "Selected lore",
      formatLoreGenerationEntries(
        activatedLoreEntries.filter(
          (entry) => entry.entry.insertionPosition === "before-character",
        ),
        { includeSummary: true, macroContext, summarizedLorebookIds },
      ),
    ),
    ...namedGenerationBlock(
      "Active persona",
      activePersona
        ? personaGenerationContext(activePersona, "Persona instructions", { macroContext })
        : ["Anonymous user"],
    ),
    ...companions.flatMap((companion) =>
      namedGenerationBlock(
        companion.id === targetCompanion?.id ? "Replying character" : "Other character",
        characterGenerationContext(companion, {
          includeExamples: false,
          macroContext,
          systemPromptLabel: "Character instructions",
        }),
      ),
    ),
    ...namedGenerationBlock(
      "Selected lore",
      formatLoreGenerationEntries(
        activatedLoreEntries.filter((entry) => entry.entry.insertionPosition === "after-character"),
        { includeSummary: true, macroContext, summarizedLorebookIds },
      ),
    ),
    ...namedGenerationBlock(
      "Example dialogue",
      exampleDialogueGenerationContext(companions, { macroContext }),
    ),
  ].join("\n\n");
}

interface RoleplayLoreMarkerLineCache {
  after?: string[];
  before?: string[];
  combined?: string[];
}

function buildRoleplayMarkerLines({
  activePersona,
  activatedLoreEntries,
  companions,
  loreMarkerLineCache,
  macroContext,
  markerType,
  sceneLines,
  summarizedLorebookIds,
  targetCompanion,
}: {
  activePersona: PersonaRecord | null;
  activatedLoreEntries: ActivatedLoreEntry[];
  companions: CharacterRecord[];
  loreMarkerLineCache: RoleplayLoreMarkerLineCache;
  macroContext: GenerationMacroContext;
  markerType: string;
  sceneLines: () => string[];
  summarizedLorebookIds: Set<string>;
  targetCompanion: CharacterRecord | null;
}) {
  const formatLoreEntries = (entries: ActivatedLoreEntry[]) =>
    formatLoreGenerationEntries(entries, {
      includeSummary: true,
      macroContext,
      summarizedLorebookIds,
    });
  const beforeLoreEntries = activatedLoreEntries.filter(
    (entry) => entry.entry.insertionPosition === "before-character",
  );
  const afterLoreEntries = activatedLoreEntries.filter(
    (entry) => entry.entry.insertionPosition === "after-character",
  );
  const beforeLoreLines = () =>
    (loreMarkerLineCache.before ??= formatLoreEntries(beforeLoreEntries));
  const afterLoreLines = () => (loreMarkerLineCache.after ??= formatLoreEntries(afterLoreEntries));
  const combinedLoreLines = () => {
    if (loreMarkerLineCache.combined) return loreMarkerLineCache.combined;

    const content = [beforeLoreLines().join("\n"), afterLoreLines().join("\n")]
      .filter((block) => block.trim())
      .join("\n\n");
    loreMarkerLineCache.combined = content ? [`Selected lore\n${content}`] : [];
    return loreMarkerLineCache.combined;
  };

  switch (markerType) {
    case "chat_summary":
      return namedGenerationBlock("Scene", sceneLines());
    case "lorebook":
      return combinedLoreLines();
    case "world_info_before":
      return namedGenerationBlock("Selected lore", beforeLoreLines());
    case "world_info_after":
      return namedGenerationBlock("Selected lore", afterLoreLines());
    case "persona":
      return namedGenerationBlock(
        "Active persona",
        activePersona
          ? personaGenerationContext(activePersona, "Persona instructions", { macroContext })
          : ["Anonymous user"],
      );
    case "character":
      return companions.flatMap((companion) =>
        namedGenerationBlock(
          companion.id === targetCompanion?.id ? "Replying character" : "Other character",
          characterGenerationContext(companion, {
            includeExamples: false,
            macroContext,
            systemPromptLabel: "Character instructions",
          }),
        ),
      );
    case "dialogue_examples":
      return namedGenerationBlock(
        "Example dialogue",
        exampleDialogueGenerationContext(companions, { macroContext }),
      );
    default:
      return [];
  }
}

function roleplaySelectedPromptSource(
  thread: RoleplayModeThread,
  promptPreset: PromptPresetRecord | null,
) {
  const branch = getActiveModeBranch(thread);
  if (branch.systemPromptMode === "custom" && branch.systemPrompt) return branch.systemPrompt;
  return promptPreset?.systemPrompt.trim() || DEFAULT_ROLEPLAY_SYSTEM_PROMPT;
}

function resolveRoleplaySceneLines(
  thread: RoleplayModeThread,
  macroContext: GenerationMacroContext,
) {
  return [thread.title ? `Title: ${resolveGenerationMacros(thread.title, macroContext)}` : ""];
}

function resolveRoleplayPromptPrelude(
  thread: RoleplayModeThread,
  macroContext: GenerationMacroContext,
  promptPreset: PromptPresetRecord | null,
) {
  return {
    selectedPrompt: resolveGenerationMacros(
      roleplaySelectedPromptSource(thread, promptPreset),
      macroContext,
    ),
    sceneLines: resolveRoleplaySceneLines(thread, macroContext),
  };
}

function buildPostHistoryPrompt({
  activePersona,
  macroContext,
  promptPreset,
  targetCompanion,
}: {
  activePersona: PersonaRecord | null;
  macroContext: GenerationMacroContext;
  promptPreset: PromptPresetRecord | null;
  targetCompanion: CharacterRecord | null;
}) {
  const targetName = macroContext.char;
  const userName = macroContext.user;
  const targetPostHistoryInstructions = targetCompanion?.postHistoryInstructions
    ? resolveGenerationMacros(targetCompanion.postHistoryInstructions, macroContext)
    : "";
  const personaPostHistoryInstructions = activePersona?.postHistoryInstructions
    ? resolveGenerationMacros(activePersona.postHistoryInstructions, macroContext)
    : "";

  const outputContract = promptPreset
    ? [
        `Continue the scene with ${targetName} as the primary character.`,
        `Never write ${userName}'s dialogue, intent, decisions, or deliberate actions.`,
        "Follow the selected preset's output behavior for narration and other characters.",
        "Do not include metadata, markdown fences, or out-of-world notes.",
      ]
    : [
        `Continue the scene as ${targetName}.`,
        `Write only ${targetName}'s next turn as one character entry. Do not write ${userName}'s dialogue, intent, decisions, deliberate actions, response, narrator text, scene-beat text, or other characters' lines.`,
        "Do not include speaker labels, scene labels, metadata, markdown fences, or out-of-world notes.",
      ];

  return [
    targetPostHistoryInstructions.trim()
      ? `Character post-history instructions: ${targetPostHistoryInstructions}`
      : "",
    personaPostHistoryInstructions.trim()
      ? `Persona post-history instructions: ${personaPostHistoryInstructions}`
      : "",
    ...outputContract,
  ]
    .filter((line) => line.trim())
    .join("\n");
}

function createRoleplayPromptAssembly({
  activePersona,
  companions,
  lorebookSources,
  loreInsertionStrategy,
  loreRuntimeState,
  now,
  promptPreset,
  providerConnection,
  thread,
  targetCompanion,
  timeZone,
  variables,
  variableNames,
}: {
  activePersona: PersonaRecord | null;
  companions: CharacterRecord[];
  lorebookSources: LorebookSourceBuckets;
  loreInsertionStrategy: LoreInsertionStrategy;
  loreRuntimeState?: LoreRuntimeState | null;
  now: string;
  promptPreset: PromptPresetRecord | null;
  providerConnection: ProviderConnectionRecord | null;
  thread: RoleplayModeThread;
  targetCompanion: CharacterRecord | null;
  timeZone?: string | null;
  variables?: Record<string, string>;
  variableNames?: string[];
}): GenerationPromptAssemblyResult {
  if (
    loreRuntimeState &&
    (loreRuntimeState.ownerKind !== "mode-branch" ||
      loreRuntimeState.ownerId !== getActiveModeBranch(thread).id)
  ) {
    throw new Error("Invalid Roleplay lore runtime state owner");
  }
  const macroVariableMutations: MacroVariableMutation[] = [];
  const macroContext = createGenerationMacroContext({
    activePersona,
    companions,
    lastInput: latestRoleplayInput(thread),
    now,
    providerConnection,
    targetCompanion,
    targetNameFallback: "the selected character",
    threadId: thread.id,
    timeZone,
    variables,
    variableMutations: macroVariableMutations,
  });
  resolveGenerationMacroVariableValues(macroContext, variableNames ?? []);
  let preludeCache: ReturnType<typeof resolveRoleplayPromptPrelude> | null = null;
  let sceneLinesCache: string[] | null = null;
  const sceneLines = () => (sceneLinesCache ??= resolveRoleplaySceneLines(thread, macroContext));
  const prelude = () =>
    (preludeCache ??= resolveRoleplayPromptPrelude(thread, macroContext, promptPreset));
  const loreActivation = activateLoreGenerationEntriesWithWarnings(lorebookSources, {
    activePersona,
    companions,
    contextTokens: providerConnection?.maxContext ?? null,
    includeSummary: true,
    insertionStrategy: loreInsertionStrategy,
    macroContext,
    runtimeState: loreRuntimeState,
    scanSources: roleplayLoreScanSources(thread),
  });
  const activatedLoreEntries = loreActivation.entries;
  const transcript = getActiveModeBranchMessages(thread)
    .filter((message) => getActiveModeMessageVersion(message).body.trim())
    .map((message) => ({
      role: roleplayMessageRole(message),
      content: roleplayMessageContent(message),
    }));
  const summarizedLorebookIds = new Set<string>();
  let transcriptWithDepthLoreCache: RoleplayGenerationPromptMessage[] | null = null;
  const transcriptWithDepthLore = () => {
    transcriptWithDepthLoreCache ??= injectAtDepth(
      transcript,
      activatedLoreEntries.filter((entry) => entry.entry.insertionPosition === "at-depth"),
      { includeSummary: true, macroContext, providerConnection, summarizedLorebookIds },
    );
    return transcriptWithDepthLoreCache;
  };
  const loreMarkerLineCache: RoleplayLoreMarkerLineCache = {};
  const postHistoryMessages = (): RoleplayGenerationPromptMessage[] => {
    const postHistoryPrompt = buildPostHistoryPrompt({
      activePersona,
      macroContext,
      promptPreset,
      targetCompanion,
    });
    return postHistoryPrompt
      ? [
          {
            role: "user",
            content: postHistoryPrompt,
          },
        ]
      : [];
  };
  const promptMessages: RoleplayGenerationPromptMessage[] = promptPreset?.sections.length
    ? assemblePromptPresetMessages({
        fallbackSystemPrompt: () => roleplaySelectedPromptSource(thread, promptPreset),
        macroContext,
        markerLines: (markerType) =>
          buildRoleplayMarkerLines({
            activePersona,
            activatedLoreEntries,
            companions,
            loreMarkerLineCache,
            macroContext,
            markerType,
            sceneLines,
            summarizedLorebookIds,
            targetCompanion,
          }),
        preset: promptPreset,
        providerConnection,
        tailMessages: postHistoryMessages,
        transcriptMessages: transcriptWithDepthLore,
      })
    : (() => {
        const systemPrompt = buildRoleplaySystemPrompt({
          activePersona,
          activatedLoreEntries,
          companions,
          macroContext,
          prelude: prelude(),
          summarizedLorebookIds,
          targetCompanion,
        });

        return [
          {
            role: "system" as const,
            content: systemPrompt,
          },
          ...transcriptWithDepthLore(),
          ...postHistoryMessages(),
        ];
      })();
  settleUnrenderedLoreGenerationEntries(activatedLoreEntries, macroContext);
  const finalLoreRuntimeState = finalizeLoreGenerationRuntimeState(loreActivation);

  return {
    loreRuntimeState: finalLoreRuntimeState,
    macroVariableMutations,
    promptMessages,
    warnings: loreActivation.warnings,
  };
}

export function createRoleplayGenerationRequest({
  context,
  id,
  loreRuntimeState,
  now,
  parameters,
  timeZone,
}: {
  context: RoleplayGenerationContext;
  id: string;
  loreRuntimeState?: LoreRuntimeState | null;
  now: string;
  parameters?: Partial<RoleplayGenerationParameters>;
  /** IANA time zone for display macros; omitted or `null` uses UTC. */
  timeZone?: string | null;
}): RoleplayGenerationRequest {
  return createRoleplayGenerationRequestAssembly({
    context,
    id,
    loreRuntimeState,
    now,
    parameters,
    timeZone,
  }).request;
}

export function createRoleplayGenerationRequestAssembly({
  context,
  id,
  loreRuntimeState,
  now,
  parameters,
  timeZone,
}: {
  context: RoleplayGenerationContext;
  id: string;
  loreRuntimeState?: LoreRuntimeState | null;
  now: string;
  parameters?: Partial<RoleplayGenerationParameters>;
  /** IANA time zone for display macros; omitted or `null` uses UTC. */
  timeZone?: string | null;
}): RoleplayGenerationRequestAssembly {
  const targetCompanion = getNextRoleplayCompanion(context.requestThread, context.companions);
  const promptAssembly = createRoleplayPromptAssembly({
    activePersona: context.activePersona,
    companions: context.companions,
    lorebookSources: context.lorebookSources,
    loreInsertionStrategy: context.loreInsertionStrategy,
    loreRuntimeState,
    now,
    promptPreset: context.promptPreset,
    providerConnection: context.providerConnection,
    thread: context.requestThread,
    targetCompanion,
    timeZone,
    variables: context.variables,
    variableNames: context.ephemeralVariableNames,
  });

  return createGenerationRequestAssemblyResult<RoleplayModeThread, RoleplayGenerationRequest>({
    context,
    createRequest: (request) => request,
    id,
    now,
    parameters,
    promptAssembly,
    targetCompanion,
    thread: createActiveModeThreadSnapshot(context.requestThread),
  });
}
