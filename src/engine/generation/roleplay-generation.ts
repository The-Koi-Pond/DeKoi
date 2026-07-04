import type { CharacterRecord } from "../contracts/types/character";
import type { LorebookRecord, LoreInsertionStrategy } from "../contracts/types/lorebook";
import type { LoreRuntimeState } from "../contracts/types/lore-runtime-state";
import type { AppSettings } from "../contracts/types/app-settings";
import type { PersonaRecord } from "../contracts/types/persona";
import type { ProviderConnectionRecord } from "../contracts/types/provider-connection";
import type { RoleplayEntry, RoleplayThread } from "../contracts/types/roleplay";
import type {
  ActivatedLoreEntry,
  LorebookScanSource,
} from "../generation-core/lorebook-activation";
import {
  activateLoreGenerationEntriesWithWarnings,
  characterGenerationContext,
  cleanGenerationText,
  createGenerationMacroContext,
  createGenerationParameters,
  exampleDialogueGenerationContext,
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

export interface RoleplayGenerationRequestAssembly {
  request: RoleplayGenerationRequest;
  loreRuntimeState: LoreRuntimeState | null;
}

export interface RoleplayGenerationRequest {
  schemaVersion: 1;
  id: string;
  createdAt: string;
  thread: RoleplayThread;
  companions: CharacterRecord[];
  activePersona: PersonaRecord | null;
  lorebooks: LorebookRecord[];
  providerConnectionId: string | null;
  providerConnection: ProviderConnectionRecord | null;
  targetCharacterId: string | null;
  targetCharacterName: string | null;
  promptMessages: RoleplayGenerationPromptMessage[];
  parameters: RoleplayGenerationParameters;
  /**
   * Non-fatal app-side context or activation warnings to surface after generation.
   */
  warnings: string[];
}

export interface RoleplayGenerationContext {
  activePersona: PersonaRecord | null;
  companions: CharacterRecord[];
  lorebooks: LorebookRecord[];
  lorebookSources: LorebookSourceBuckets;
  loreInsertionStrategy: LoreInsertionStrategy;
  providerConnectionId: string | null;
  providerConnection: ProviderConnectionRecord | null;
  requestThread: RoleplayThread;
  warnings: string[];
}

export interface RoleplayGenerationContextInput {
  thread: RoleplayThread;
  characters: CharacterRecord[];
  personas: PersonaRecord[];
  lorebooks: LorebookRecord[];
  appSettings?: Pick<AppSettings, "globalLorebookIds" | "loreInsertionStrategy"> | null;
  providerConnections?: ProviderConnectionRecord[];
  fallbackProviderConnectionId?: string | null;
}

function roleplayEntryRole(entry: RoleplayEntry): RoleplayGenerationPromptMessage["role"] {
  return entry.role === "character" ? "assistant" : "user";
}

function roleplayEntryContent(entry: RoleplayEntry) {
  const label = cleanGenerationText(entry.label) || "Unknown";
  if (entry.role === "scene") return `Scene: ${entry.body.trim()}`;
  if (entry.role === "narration") return `Narration: ${entry.body.trim()}`;
  return `${label}: ${entry.body.trim()}`;
}

function roleplayLoreScanSources(thread: RoleplayThread): LorebookScanSource[] {
  return thread.entries.map((entry) => ({
    name: cleanGenerationText(entry.label) || null,
    body: entry.body,
  }));
}

function latestRoleplayInput(thread: RoleplayThread) {
  for (let index = thread.entries.length - 1; index >= 0; index -= 1) {
    if (thread.entries[index].body.trim()) return thread.entries[index].body;
  }

  return null;
}

function getNextRoleplayCompanion(thread: RoleplayThread, companions: CharacterRecord[]) {
  const availableCompanions = companions.filter((companion) =>
    thread.characterIds.includes(companion.id),
  );
  if (availableCompanions.length === 0) return null;

  const companionEntryCount = thread.entries.filter(
    (entry) =>
      entry.role === "character" &&
      !!entry.characterId &&
      thread.characterIds.includes(entry.characterId),
  ).length;
  return availableCompanions[companionEntryCount % availableCompanions.length];
}

export function createRoleplayGenerationContext({
  appSettings = null,
  characters,
  fallbackProviderConnectionId = null,
  lorebooks,
  personas,
  providerConnections = [],
  thread,
}: RoleplayGenerationContextInput): RoleplayGenerationContext {
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
    warningPrefix: "Roleplay thread",
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
      providerConnectionId: records.providerConnectionId,
    },
    warnings: records.warnings,
  };
}

function buildRoleplaySystemPrompt({
  activePersona,
  activatedLoreEntries,
  companions,
  macroContext,
  summarizedLorebookIds,
  targetCompanion,
  thread,
}: {
  activePersona: PersonaRecord | null;
  activatedLoreEntries: ActivatedLoreEntry[];
  companions: CharacterRecord[];
  macroContext: GenerationMacroContext;
  summarizedLorebookIds: Set<string>;
  targetCompanion: CharacterRecord | null;
  thread: RoleplayThread;
}) {
  const selectedPrompt = resolveGenerationMacros(DEFAULT_ROLEPLAY_SYSTEM_PROMPT, macroContext);

  return [
    selectedPrompt,
    ...namedGenerationBlock("Scene", [
      thread.title ? `Title: ${resolveGenerationMacros(thread.title, macroContext)}` : "",
      thread.sceneText ? resolveGenerationMacros(thread.sceneText, macroContext) : "",
    ]),
    ...namedGenerationBlock(
      "Selected lore",
      formatLoreGenerationEntries(
        activatedLoreEntries.filter(
          (entry) => entry.entry.insertionPosition === "before-character",
        ),
        { includeSummary: true, summarizedLorebookIds },
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
        { includeSummary: true, summarizedLorebookIds },
      ),
    ),
    ...namedGenerationBlock(
      "Example dialogue",
      exampleDialogueGenerationContext(companions, { macroContext }),
    ),
  ].join("\n\n");
}

function buildPostHistoryPrompt({
  activePersona,
  macroContext,
  targetCompanion,
}: {
  activePersona: PersonaRecord | null;
  macroContext: GenerationMacroContext;
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

  return [
    `Continue the scene as ${targetName}.`,
    `Write only ${targetName}'s next turn. Do not write ${userName}'s response.`,
    targetPostHistoryInstructions.trim()
      ? `Character post-history instructions: ${targetPostHistoryInstructions}`
      : "",
    personaPostHistoryInstructions.trim()
      ? `Persona post-history instructions: ${personaPostHistoryInstructions}`
      : "",
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
  providerConnection,
  thread,
  targetCompanion,
}: {
  activePersona: PersonaRecord | null;
  companions: CharacterRecord[];
  lorebookSources: LorebookSourceBuckets;
  loreInsertionStrategy: LoreInsertionStrategy;
  loreRuntimeState?: LoreRuntimeState | null;
  now: string;
  providerConnection: ProviderConnectionRecord | null;
  thread: RoleplayThread;
  targetCompanion: CharacterRecord | null;
}): {
  loreRuntimeState: LoreRuntimeState | null;
  promptMessages: RoleplayGenerationPromptMessage[];
  warnings: string[];
} {
  const macroContext = createGenerationMacroContext({
    activePersona,
    companions,
    lastInput: latestRoleplayInput(thread),
    now,
    providerConnection,
    targetCompanion,
    targetNameFallback: "the selected character",
    threadId: thread.id,
  });
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
  const transcript = thread.entries
    .filter((entry) => entry.body.trim())
    .map((entry) => ({
      role: roleplayEntryRole(entry),
      content: roleplayEntryContent(entry),
    }));
  const summarizedLorebookIds = new Set<string>();
  const systemPrompt = buildRoleplaySystemPrompt({
    activePersona,
    activatedLoreEntries,
    companions,
    macroContext,
    summarizedLorebookIds,
    targetCompanion,
    thread,
  });
  const transcriptWithDepthLore = injectAtDepth(
    transcript,
    activatedLoreEntries.filter((entry) => entry.entry.insertionPosition === "at-depth"),
    { includeSummary: true, providerConnection, summarizedLorebookIds },
  );

  return {
    loreRuntimeState: loreActivation.runtimeState,
    promptMessages: [
      {
        role: "system",
        content: systemPrompt,
      },
      ...transcriptWithDepthLore,
      {
        role: "user",
        content: buildPostHistoryPrompt({ activePersona, macroContext, targetCompanion }),
      },
    ],
    warnings: loreActivation.warnings,
  };
}

export function createRoleplayGenerationRequest({
  context,
  id,
  loreRuntimeState,
  now,
  parameters,
}: {
  context: RoleplayGenerationContext;
  id: string;
  loreRuntimeState?: LoreRuntimeState | null;
  now: string;
  parameters?: Partial<RoleplayGenerationParameters>;
}): RoleplayGenerationRequest {
  return createRoleplayGenerationRequestAssembly({
    context,
    id,
    loreRuntimeState,
    now,
    parameters,
  }).request;
}

export function createRoleplayGenerationRequestAssembly({
  context,
  id,
  loreRuntimeState,
  now,
  parameters,
}: {
  context: RoleplayGenerationContext;
  id: string;
  loreRuntimeState?: LoreRuntimeState | null;
  now: string;
  parameters?: Partial<RoleplayGenerationParameters>;
}): RoleplayGenerationRequestAssembly {
  const targetCompanion = getNextRoleplayCompanion(context.requestThread, context.companions);
  const promptAssembly = createRoleplayPromptAssembly({
    activePersona: context.activePersona,
    companions: context.companions,
    lorebookSources: context.lorebookSources,
    loreInsertionStrategy: context.loreInsertionStrategy,
    loreRuntimeState,
    now,
    providerConnection: context.providerConnection,
    thread: context.requestThread,
    targetCompanion,
  });

  return {
    request: {
      schemaVersion: 1,
      id,
      createdAt: now,
      thread: context.requestThread,
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
