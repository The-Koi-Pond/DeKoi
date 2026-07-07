import type {
  MessengerGenerationRequest,
  MessengerGenerationResponse,
} from "../../../engine/generation/messenger-generation";
import {
  createMessengerGenerationContext,
  createMessengerGenerationRequestAssembly,
} from "../../../engine/generation/messenger-generation";
import {
  appendMessengerMessages,
  createGeneratedCompanionMessage,
} from "../../../engine/modes/messenger/messenger-actions";
import type { AppSettings } from "../../../engine/contracts/types/app-settings";
import type { CharacterRecord } from "../../../engine/contracts/types/character";
import type { LorebookRecord } from "../../../engine/contracts/types/lorebook";
import type { LoreRuntimeState } from "../../../engine/contracts/types/lore-runtime-state";
import type { MacroVariableScope } from "../../../engine/contracts/types/macro-variables";
import type { MessengerMessage, MessengerThread } from "../../../engine/contracts/types/messenger";
import type { PersonaRecord } from "../../../engine/contracts/types/persona";
import type { ProviderConnectionRecord } from "../../../engine/contracts/types/provider-connection";
import { createGeneratedDraftRecords } from "./generated-draft-records";
import { describeGenerationTransport } from "./generation-transport";
import {
  compactGenerationLoreRuntimeState,
  createGenerationLoreRuntimeState,
} from "./lore-runtime-state";
import {
  buildGenerationMacroVariableState,
  type MacroVariableStateCommit,
} from "../../../engine/macro-variables/macro-variable-actions";
import { providerMessengerGenerationAdapter } from "./provider-messenger-generation";

export interface GenerateMessengerThreadReplyInput {
  thread: MessengerThread;
  appSettings: AppSettings;
  userMessage: MessengerMessage;
  characters: CharacterRecord[];
  personas: PersonaRecord[];
  lorebooks: LorebookRecord[];
  loreRuntimeState?: LoreRuntimeState | null;
  macroVariableStates?: MacroVariableScope[];
  providerConnections: ProviderConnectionRecord[];
  fallbackProviderConnectionId?: string | null;
  now: string;
  parameters?: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
  };
  createId: (prefix: string) => string;
}

export interface GenerateMessengerThreadReplyResult {
  thread: MessengerThread;
  response: MessengerGenerationResponse;
  generatedMessages: MessengerMessage[];
  loreRuntimeState: LoreRuntimeState | null;
  macroVariableCommit: MacroVariableStateCommit;
  runtimeLabel: string;
  warnings: string[];
}

async function generateMessengerResponse(
  request: MessengerGenerationRequest,
): Promise<MessengerGenerationResponse> {
  return providerMessengerGenerationAdapter.generate(request);
}

export async function generateMessengerThreadReply({
  appSettings,
  characters,
  createId,
  fallbackProviderConnectionId = null,
  lorebooks,
  loreRuntimeState,
  macroVariableStates = [],
  now,
  parameters,
  personas,
  providerConnections,
  thread,
  userMessage,
}: GenerateMessengerThreadReplyInput): Promise<GenerateMessengerThreadReplyResult> {
  const generationTransport = describeGenerationTransport();
  const macroVariableSelection = buildGenerationMacroVariableState({
    macroVariableStates,
    ownerId: thread.id,
    ownerKind: "messenger-thread",
  });
  const context = createMessengerGenerationContext({
    appSettings,
    characters,
    fallbackProviderConnectionId,
    lorebooks,
    personas,
    providerConnections,
    thread,
    variables: macroVariableSelection.variables,
  });
  const generationLoreRuntimeState = createGenerationLoreRuntimeState({
    createId,
    existingState: loreRuntimeState,
    now,
    ownerId: thread.id,
    ownerKind: "messenger-thread",
  });
  const requestAssembly = createMessengerGenerationRequestAssembly({
    context,
    id: createId("messenger-generation-request"),
    loreRuntimeState: generationLoreRuntimeState,
    now,
    parameters,
    userMessage,
  });
  const request = requestAssembly.request;
  const response = await generateMessengerResponse(request);
  const draftRecords = createGeneratedDraftRecords({
    companions: context.companions,
    createRecord: ({ body, companion, id, now }) =>
      createGeneratedCompanionMessage({
        body,
        companion,
        id,
        now,
        thread,
      }),
    nextId: () => createId("messenger-message"),
    response,
  });
  const generatedMessages = draftRecords.records;
  const warnings = [...response.warnings, ...draftRecords.warnings, ...request.warnings];
  const variableMutations =
    generatedMessages.length > 0 ? requestAssembly.macroVariableMutations : [];

  return {
    thread:
      generatedMessages.length > 0 ? appendMessengerMessages(thread, generatedMessages) : thread,
    response,
    generatedMessages,
    loreRuntimeState: compactGenerationLoreRuntimeState(
      requestAssembly.loreRuntimeState,
      response.createdAt,
    ),
    macroVariableCommit: {
      variableMutations,
      now: response.createdAt,
      ownerId: thread.id,
      ownerKind: "messenger-thread",
      selection: macroVariableSelection,
    },
    runtimeLabel: generationTransport.label,
    warnings,
  };
}
