import type { CharacterRecord } from "../../../engine/contracts/types/character";
import type {
  LoreRuntimeState,
  LoreRuntimeStateOwnerKind,
} from "../../../engine/contracts/types/lore-runtime-state";
import type { MacroVariableScope } from "../../../engine/contracts/types/macro-variables";
import type {
  GenerationRequestBase,
  GenerationRequestAssemblyResult,
  GenerationResponse,
} from "../../../engine/generation/generation";
import {
  buildGenerationMacroVariableState,
  type MacroVariableStateCommit,
  type MacroVariableThreadOwnerKind,
} from "../../../engine/macro-variables/macro-variable-actions";
import { createGeneratedDraftRecords } from "./generated-draft-records";
import {
  compactGenerationLoreRuntimeState,
  createGenerationLoreRuntimeState,
} from "./lore-runtime-state";

type ThreadGenerationOwnerKind = MacroVariableThreadOwnerKind & LoreRuntimeStateOwnerKind;

interface GenerationWorkflowContext {
  companions: CharacterRecord[];
  /** Request-local prompt variables whose mutations should be ignored on commit. */
  ephemeralVariableNames?: readonly string[];
}

interface GeneratedWorkflowRecordInput {
  body: string;
  companion: CharacterRecord;
  id: string;
  now: string;
}

export interface RunGenerationWorkflowInput<
  Thread extends { id: string },
  Context extends GenerationWorkflowContext,
  Request extends GenerationRequestBase,
  Response extends GenerationResponse,
  GeneratedRecord,
> {
  appendRecords: (thread: Thread, records: GeneratedRecord[]) => Thread;
  createContext: (variables: Record<string, string>) => Context;
  createId: (prefix: string) => string;
  createRecord: (input: GeneratedWorkflowRecordInput) => GeneratedRecord;
  createRequestAssembly: (input: {
    context: Context;
    id: string;
    loreRuntimeState: LoreRuntimeState;
  }) => GenerationRequestAssemblyResult<Request>;
  existingLoreRuntimeState?: LoreRuntimeState | null;
  generateResponse: (request: Request) => Promise<Response>;
  macroVariableStates?: MacroVariableScope[];
  ownerKind: ThreadGenerationOwnerKind;
  recordIdPrefix: string;
  requestIdPrefix: string;
  thread: Thread;
  now: string;
}

export interface RunGenerationWorkflowResult<
  Thread,
  Response extends GenerationResponse,
  GeneratedRecord,
> {
  thread: Thread;
  response: Response;
  generatedRecords: GeneratedRecord[];
  loreRuntimeState: LoreRuntimeState | null;
  macroVariableCommit: MacroVariableStateCommit;
  warnings: string[];
}

export async function runGenerationWorkflow<
  Thread extends { id: string },
  Context extends GenerationWorkflowContext,
  Request extends GenerationRequestBase,
  Response extends GenerationResponse,
  GeneratedRecord,
>({
  appendRecords,
  createContext,
  createId,
  createRecord,
  createRequestAssembly,
  existingLoreRuntimeState,
  generateResponse,
  macroVariableStates = [],
  now,
  ownerKind,
  recordIdPrefix,
  requestIdPrefix,
  thread,
}: RunGenerationWorkflowInput<Thread, Context, Request, Response, GeneratedRecord>): Promise<
  RunGenerationWorkflowResult<Thread, Response, GeneratedRecord>
> {
  const macroVariableSelection = buildGenerationMacroVariableState({
    macroVariableStates,
    ownerId: thread.id,
    ownerKind,
  });
  const context = createContext(macroVariableSelection.variables);
  const generationLoreRuntimeState = createGenerationLoreRuntimeState({
    createId,
    existingState: existingLoreRuntimeState,
    now,
    ownerId: thread.id,
    ownerKind,
  });
  const requestAssembly = createRequestAssembly({
    context,
    id: createId(requestIdPrefix),
    loreRuntimeState: generationLoreRuntimeState,
  });
  const request = requestAssembly.request;
  const response = await generateResponse(request);
  const draftRecords = createGeneratedDraftRecords({
    companions: context.companions,
    createRecord,
    nextId: () => createId(recordIdPrefix),
    response,
  });
  const generatedRecords = draftRecords.records;
  const warnings = [...response.warnings, ...draftRecords.warnings, ...request.warnings];
  const variableMutations =
    generatedRecords.length > 0 ? requestAssembly.macroVariableMutations : [];

  return {
    thread: generatedRecords.length > 0 ? appendRecords(thread, generatedRecords) : thread,
    response,
    generatedRecords,
    loreRuntimeState: compactGenerationLoreRuntimeState(
      requestAssembly.loreRuntimeState,
      response.createdAt,
    ),
    macroVariableCommit: {
      variableMutations,
      ephemeralVariableNames: [...(context.ephemeralVariableNames ?? [])],
      now: response.createdAt,
      ownerId: thread.id,
      ownerKind,
      selection: macroVariableSelection,
    },
    warnings,
  };
}
