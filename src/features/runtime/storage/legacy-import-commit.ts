import type { ModeMessageAuthor } from "../../../engine/contracts/types/mode-thread";
import { assertValidModeThread } from "../../../engine/modes/mode-thread/mode-thread-validation";
import type { DeKoiLegacyImportData } from "../../../runtime";

export type LegacyImportIdFactory = (prefix: string) => string;

const GLOBAL_OWNER_ID = "global";

function mapNonEmpty<T, U>(values: [T, ...T[]], map: (value: T) => U): [U, ...U[]] {
  return [map(values[0]), ...values.slice(1).map(map)];
}

function remapIds<T extends { id: string }>(
  records: T[],
  prefix: string,
  createId: LegacyImportIdFactory,
) {
  const ids = new Map<string, string>();
  const remapped = records.map((record) => {
    const id = createId(prefix);
    if (!ids.has(record.id)) ids.set(record.id, id);
    return { ...record, id };
  });
  return [remapped, ids] as const;
}

function remapAuthor(
  author: ModeMessageAuthor,
  characters: ReadonlyMap<string, string>,
  personas: ReadonlyMap<string, string>,
): ModeMessageAuthor {
  if (author.kind === "character") {
    const id = characters.get(author.characterId);
    return id ? { ...author, characterId: id } : { kind: "unknown", label: author.label };
  }
  if (author.kind === "persona") {
    const id = personas.get(author.personaId);
    return id ? { ...author, personaId: id } : { kind: "unknown", label: author.label };
  }
  return author;
}

export function restampLegacyImportData(
  data: DeKoiLegacyImportData,
  createId: LegacyImportIdFactory,
): DeKoiLegacyImportData {
  const [rawCharacters, characterIds] = remapIds(data.characters, "character", createId);
  const characters = rawCharacters.map((record) => ({ ...record, lorebookIds: [] }));
  const [rawPersonas, personaIds] = remapIds(data.personas, "persona", createId);
  const personas = rawPersonas.map((record) => ({ ...record, lorebookIds: [] }));
  const [providerConnections, providerIds] = remapIds(
    data.providerConnections,
    "connection",
    createId,
  );
  const globalStates = data.macroVariableStates
    .filter((state) => state.ownerKind === "global")
    .map((state) => ({ ...state, id: createId("macro-variable-state"), ownerId: GLOBAL_OWNER_ID }));
  const threadResults = data.modeThreads.map((thread, index) => {
    const id = createId("mode-thread");
    const branchIds = new Map(
      thread.branches.map((branch) => [branch.id, createId("mode-branch")] as const),
    );
    const activeBranchId =
      branchIds.get(thread.activeBranchId) ?? branchIds.get(thread.branches[0].id)!;
    const branches = mapNonEmpty(thread.branches, (branch) => {
      const characterIdsForBranch = branch.characterIds.flatMap((value) =>
        characterIds.has(value) ? [characterIds.get(value)!] : [],
      );
      return {
        ...branch,
        id: branchIds.get(branch.id) ?? createId("mode-branch"),
        threadId: id,
        participantMode:
          characterIdsForBranch.length > 1 ? ("group" as const) : ("direct" as const),
        characterIds: characterIdsForBranch,
        activePersonaId:
          branch.activePersonaId === null ? null : (personaIds.get(branch.activePersonaId) ?? null),
        providerConnectionId:
          branch.providerConnectionId === null
            ? null
            : (providerIds.get(branch.providerConnectionId) ?? null),
        lorebookIds: [],
        presetId: null,
        presetChoiceSelectionsByPresetId: {},
      };
    });
    return {
      sourceId: thread.id,
      thread: { ...thread, id, activeBranchId, branches, messages: [] },
      macroVariableState: data.messengerThreadMacroVariableStates[index]
        ? {
            ...data.messengerThreadMacroVariableStates[index]!,
            id: createId("macro-variable-state"),
            ownerKind: "mode-branch" as const,
            ownerId: activeBranchId,
          }
        : null,
      branchIds,
    };
  });
  const modeThreads = threadResults.map((result, index) => ({
    ...result.thread,
    messages: data.modeThreads[index]!.messages.map((message) => {
      const versions = new Map(
        message.versions.map((version) => [version.id, createId("mode-version")] as const),
      );
      return {
        ...message,
        id: createId("mode-message"),
        threadId: result.thread.id,
        branchId: result.branchIds.get(message.branchId) ?? result.thread.activeBranchId,
        author: remapAuthor(message.author, characterIds, personaIds),
        versions: mapNonEmpty(message.versions, (version) => ({
          ...version,
          id: versions.get(version.id)!,
        })),
        activeVersionId: versions.get(message.activeVersionId) ?? versions.values().next().value!,
      };
    }),
  }));
  modeThreads.forEach(assertValidModeThread);
  return {
    ...data,
    characters,
    personas,
    providerConnections,
    macroVariableStates: [
      ...globalStates,
      ...threadResults.flatMap((result) =>
        result.macroVariableState ? [result.macroVariableState] : [],
      ),
    ],
    modeThreads,
  };
}
