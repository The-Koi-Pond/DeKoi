import { useCallback } from "react";
import type { SurfaceId } from "../../../engine/contracts/constants/surfaces";
import { MESSENGER } from "../../../engine/contracts/constants/surfaces";
import { DEFAULT_APP_SETTINGS } from "../../../engine/contracts/types/app-settings";
import {
  attachMessengerMessagesToThreads,
  type MessengerMessageAuthor,
} from "../../../engine/contracts/types/messenger";
import type { MacroVariableScope } from "../../../engine/contracts/types/macro-variables";
import { attachRoleplayEntriesToThreads } from "../../../engine/contracts/types/roleplay";
import { createRecordId } from "../../../shared/browser/record-id";
import {
  APP_STORAGE_COLLECTION_KEYS,
  appStorageCollectionCount,
  type AppStorageRecords,
  type AppStorageReplaceResult,
} from "../../runtime";
import {
  createDeKoiStorageBundle,
  createDeKoiStorageBundleFingerprint,
  type DeKoiLegacyImportData,
  type DeKoiStorageBundle,
} from "../../runtime";
import type { PondView } from "../../navigation";
import type { StateSetter } from "../../../shared/react/state-setter";

type UseAppImportExportActionsInput = AppStorageRecords & {
  providerConnections: AppStorageRecords["providerConnections"];
  setSelectedSurface: StateSetter<SurfaceId>;
  setView: (view: PondView) => void;
  commitAppStorageImport: (
    records: AppStorageRecords,
    options?: { desktopBackupPath?: string | null },
  ) => Promise<AppStorageReplaceResult>;
};

type ImportCommitOptions = {
  previewFingerprint: string;
  desktopBackupPath?: string | null;
};

type RecordIdPrefix = "character" | "connection" | "persona";
const GLOBAL_MACRO_VARIABLE_OWNER_ID = "global";
const LEGACY_GLOBAL_MACRO_VARIABLE_OVERWRITE_WARNING =
  "Imported global macro variables will overwrite same-name current global macro variables.";

function createImportActionErrorResult(
  records: AppStorageRecords,
  message: string,
): AppStorageReplaceResult {
  return {
    mode: "unavailable",
    status: "error",
    message,
    counts: Object.fromEntries(
      APP_STORAGE_COLLECTION_KEYS.map((collectionKey) => [
        collectionKey,
        appStorageCollectionCount(records, collectionKey),
      ]),
    ) as AppStorageReplaceResult["counts"],
    collections: [],
    failedCollectionKey: null,
    requiresReload: false,
    rollbackAvailable: false,
    rollbackMessage:
      "No automatic rollback was performed. Use the pre-import backup bundle to restore if needed.",
    storageMetadata: {},
  };
}

function remapIds<T extends { id: string }>(records: T[], prefix: RecordIdPrefix) {
  const idMap = new Map<string, string>();
  const remapped = records.map((record) => {
    const id = createRecordId(prefix);
    if (!idMap.has(record.id)) {
      idMap.set(record.id, id);
    }
    return {
      ...record,
      id,
    };
  });
  return [remapped, idMap] as const;
}

function remapImportedReferences(idMap: ReadonlyMap<string, string>, ids: string[]) {
  return ids.flatMap((id) => {
    const remapped = idMap.get(id);
    return remapped ? [remapped] : [];
  });
}

function remapImportedNullableReference(idMap: ReadonlyMap<string, string>, id: string | null) {
  if (id === null) return null;
  return idMap.get(id) ?? null;
}

function remapLegacyGlobalMacroVariableState(state: MacroVariableScope): MacroVariableScope {
  return {
    ...state,
    id: createRecordId("macro-variable-state"),
    ownerId: GLOBAL_MACRO_VARIABLE_OWNER_ID,
  };
}

function remapLegacyThreadMacroVariableState(
  state: MacroVariableScope,
  ownerId: string,
): MacroVariableScope {
  return {
    ...state,
    id: createRecordId("macro-variable-state"),
    ownerId,
  };
}

export function mergeLegacyImportMacroVariableStates(
  importedStates: MacroVariableScope[],
  currentStates: MacroVariableScope[],
): MacroVariableScope[] {
  const importedGlobalVariables = importedStates
    .filter((state) => state.ownerKind === "global")
    .reduce(
      (variables, state) => ({
        ...variables,
        ...state.variables,
      }),
      {} as Record<string, string>,
    );
  const hasImportedGlobalVariables = Object.keys(importedGlobalVariables).length > 0;
  const importedOwnerStates = importedStates.filter((state) => state.ownerKind !== "global");

  if (!hasImportedGlobalVariables) {
    return [...importedOwnerStates, ...currentStates];
  }

  const currentGlobalState = currentStates.find((state) => state.ownerKind === "global") ?? null;
  if (!currentGlobalState) {
    return [...importedStates, ...currentStates];
  }

  const mergedGlobalState: MacroVariableScope = {
    ...currentGlobalState,
    variables: {
      ...currentGlobalState.variables,
      ...importedGlobalVariables,
    },
    updatedAt:
      importedStates.find((state) => state.ownerKind === "global")?.updatedAt ??
      currentGlobalState.updatedAt,
  };

  return [
    ...importedOwnerStates,
    mergedGlobalState,
    ...currentStates.filter((state) => state.id !== currentGlobalState.id),
  ];
}

function hasLegacyGlobalMacroVariableNameCollision(
  importedStates: MacroVariableScope[],
  currentStates: MacroVariableScope[],
) {
  const importedGlobalVariables = importedStates
    .filter((state) => state.ownerKind === "global")
    .flatMap((state) => Object.keys(state.variables));
  const currentGlobalState = currentStates.find((state) => state.ownerKind === "global") ?? null;

  if (importedGlobalVariables.length === 0 || !currentGlobalState) {
    return false;
  }

  return importedGlobalVariables.some((name) =>
    Object.prototype.hasOwnProperty.call(currentGlobalState.variables, name),
  );
}

export function getLegacyImportPreviewWarnings(
  importWarnings: string[],
  importedStates: MacroVariableScope[],
  currentStates: MacroVariableScope[],
) {
  if (!hasLegacyGlobalMacroVariableNameCollision(importedStates, currentStates)) {
    return importWarnings;
  }

  if (importWarnings.includes(LEGACY_GLOBAL_MACRO_VARIABLE_OVERWRITE_WARNING)) {
    return importWarnings;
  }

  return [...importWarnings, LEGACY_GLOBAL_MACRO_VARIABLE_OVERWRITE_WARNING];
}

function remapLegacyMessageAuthor(
  author: MessengerMessageAuthor,
  characterIds: ReadonlyMap<string, string>,
  personaIds: ReadonlyMap<string, string>,
): MessengerMessageAuthor {
  switch (author.kind) {
    case "character": {
      const characterId = characterIds.get(author.characterId);
      if (!characterId) return { kind: "unknown", label: author.label };
      return {
        ...author,
        characterId,
      };
    }
    case "persona": {
      const personaId = personaIds.get(author.personaId);
      if (!personaId) return { kind: "unknown", label: author.label };
      return {
        ...author,
        personaId,
      };
    }
    default:
      return author;
  }
}

export function prepareLegacyImportData(data: DeKoiLegacyImportData): DeKoiLegacyImportData {
  const [characters, characterIdMap] = remapIds(data.characters, "character");
  const [personas, personaIdMap] = remapIds(data.personas, "persona");
  const [providerConnections, providerConnectionIdMap] = remapIds(
    data.providerConnections,
    "connection",
  );
  const globalMacroVariableStates = data.macroVariableStates
    .filter((state) => state.ownerKind === "global")
    .map(remapLegacyGlobalMacroVariableState);
  const threadResults = data.messengerThreads.map((thread, index) => {
    const id = createRecordId("messenger-thread");
    const threadMacroVariableState = data.messengerThreadMacroVariableStates[index] ?? null;
    return {
      thread: {
        ...thread,
        id,
        characterIds: remapImportedReferences(characterIdMap, thread.characterIds),
        activePersonaId: remapImportedNullableReference(personaIdMap, thread.activePersonaId),
        providerConnectionId: remapImportedNullableReference(
          providerConnectionIdMap,
          thread.providerConnectionId,
        ),
        messages: thread.messages.map((message) => ({
          ...message,
          id: createRecordId("messenger-message"),
          threadId: id,
          author: remapLegacyMessageAuthor(message.author, characterIdMap, personaIdMap),
        })),
      },
      macroVariableState: threadMacroVariableState
        ? remapLegacyThreadMacroVariableState(threadMacroVariableState, id)
        : null,
    };
  });
  const messengerThreads = threadResults.map((result) => result.thread);
  const macroVariableStates = [
    ...globalMacroVariableStates,
    ...threadResults.flatMap((result) =>
      result.macroVariableState ? [result.macroVariableState] : [],
    ),
  ];

  return {
    ...data,
    characters,
    personas,
    providerConnections,
    macroVariableStates,
    messengerThreads,
  };
}

export function createLegacyImportDataFingerprint(data: DeKoiLegacyImportData) {
  return createDeKoiStorageBundleFingerprint(
    createDeKoiStorageBundle({
      appSettings: DEFAULT_APP_SETTINGS,
      characters: data.characters,
      roleplayThreads: [],
      personas: data.personas,
      lorebooks: [],
      promptPresets: [],
      loreRuntimeStates: [],
      macroVariableStates: data.macroVariableStates,
      providerConnections: data.providerConnections,
      messengerThreads: data.messengerThreads,
      rippleStates: [],
    }),
  );
}

export function useAppImportExportActions({
  appSettings,
  characters,
  personas,
  lorebooks,
  promptPresets,
  loreRuntimeStates,
  macroVariableStates,
  providerConnections,
  roleplayThreads,
  messengerThreads,
  rippleStates,
  setSelectedSurface,
  setView,
  commitAppStorageImport,
}: UseAppImportExportActionsInput) {
  const createStorageBundle = useCallback(
    () =>
      createDeKoiStorageBundle({
        appSettings,
        characters,
        roleplayThreads,
        lorebooks,
        promptPresets,
        loreRuntimeStates,
        macroVariableStates,
        messengerThreads,
        personas,
        providerConnections,
        rippleStates,
      }),
    [
      appSettings,
      characters,
      roleplayThreads,
      lorebooks,
      promptPresets,
      loreRuntimeStates,
      macroVariableStates,
      messengerThreads,
      personas,
      providerConnections,
      rippleStates,
    ],
  );

  const importStorageBundle = useCallback(
    async (bundle: DeKoiStorageBundle, options: ImportCommitOptions) => {
      const importedConnections = bundle.data.providerConnections;
      const importedRoleplayThreads = attachRoleplayEntriesToThreads(
        bundle.data.roleplayThreads,
        bundle.data.roleplayEntries,
      );
      const importedMessengerThreads = attachMessengerMessagesToThreads(
        bundle.data.messengerThreads,
        bundle.data.messengerMessages,
      );
      const importedSettings = { ...bundle.data.appSettings };
      const hasActiveConnection = importedConnections.some(
        (connection) => connection.id === importedSettings.activeMessengerConnectionId,
      );
      const fallbackConnection = importedConnections[0] ?? null;

      if (!hasActiveConnection && fallbackConnection) {
        importedSettings.activeMessengerConnectionId = fallbackConnection.id;
      } else if (!hasActiveConnection) {
        importedSettings.activeMessengerConnectionId = "";
      }

      const importedRecords: AppStorageRecords = {
        appSettings: importedSettings,
        characters: bundle.data.characters,
        personas: bundle.data.personas,
        lorebooks: bundle.data.lorebooks,
        promptPresets: bundle.data.promptPresets,
        loreRuntimeStates: bundle.data.loreRuntimeStates,
        macroVariableStates: bundle.data.macroVariableStates,
        providerConnections: importedConnections,
        roleplayThreads: importedRoleplayThreads,
        messengerThreads: importedMessengerThreads,
        rippleStates: bundle.data.rippleStates,
      };

      const actualFingerprint = createDeKoiStorageBundleFingerprint(bundle);
      if (actualFingerprint !== options.previewFingerprint) {
        return createImportActionErrorResult(
          importedRecords,
          "Import preview no longer matches the bundle to commit. Preview the file again before importing.",
        );
      }

      const storageResult = await commitAppStorageImport(importedRecords, {
        desktopBackupPath: options.desktopBackupPath,
      });

      if (storageResult.status !== "ready") {
        return storageResult;
      }

      setSelectedSurface(MESSENGER);
      setView({ kind: "pond" });
      return storageResult;
    },
    [commitAppStorageImport, setSelectedSurface, setView],
  );

  const importLegacyData = useCallback(
    async (data: DeKoiLegacyImportData, options: ImportCommitOptions) => {
      const firstImportedThreadId = data.messengerThreads[0]?.id ?? null;

      const importedRecords: AppStorageRecords = {
        appSettings,
        characters: [...data.characters, ...characters],
        personas: [...data.personas, ...personas],
        lorebooks,
        promptPresets,
        loreRuntimeStates,
        macroVariableStates: mergeLegacyImportMacroVariableStates(
          data.macroVariableStates,
          macroVariableStates,
        ),
        providerConnections: [...data.providerConnections, ...providerConnections],
        roleplayThreads,
        messengerThreads: [...data.messengerThreads, ...messengerThreads],
        rippleStates,
      };

      const actualFingerprint = createLegacyImportDataFingerprint(data);
      if (actualFingerprint !== options.previewFingerprint) {
        return createImportActionErrorResult(
          importedRecords,
          "Legacy import preview no longer matches the converted records to commit. Preview the file again before importing.",
        );
      }

      const storageResult = await commitAppStorageImport(importedRecords, {
        desktopBackupPath: options.desktopBackupPath,
      });
      if (storageResult.status !== "ready") return storageResult;

      setSelectedSurface(MESSENGER);
      setView(
        firstImportedThreadId
          ? { kind: "messenger", threadId: firstImportedThreadId }
          : { kind: "pond" },
      );
      return storageResult;
    },
    [
      appSettings,
      characters,
      commitAppStorageImport,
      lorebooks,
      promptPresets,
      loreRuntimeStates,
      macroVariableStates,
      messengerThreads,
      personas,
      providerConnections,
      rippleStates,
      roleplayThreads,
      setSelectedSurface,
      setView,
    ],
  );

  return {
    createStorageBundle,
    importStorageBundle,
    importLegacyData,
  };
}
