import { useCallback } from "react";
import type { SurfaceId } from "../../../engine/contracts/constants/surfaces";
import { MESSENGER } from "../../../engine/contracts/constants/surfaces";
import { DEFAULT_APP_SETTINGS } from "../../../engine/contracts/types/app-settings";
import type { MacroVariableScope } from "../../../engine/contracts/types/macro-variables";
import { createRecordId } from "../../../shared/browser/record-id";
import {
  APP_STORAGE_COLLECTION_KEYS,
  assembleModeThreads,
  appStorageCollectionCount,
  type AppStorageRecords,
  type AppStorageReplaceResult,
  restampLegacyImportData,
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

export function prepareLegacyImportData(
  data: DeKoiLegacyImportData,
  createId: (prefix: string) => string = createRecordId,
): DeKoiLegacyImportData {
  return restampLegacyImportData(data, createId);
}

export function verifyAndPrepareLegacyImportData(
  data: DeKoiLegacyImportData,
  previewFingerprint: string,
  createId: (prefix: string) => string = createRecordId,
) {
  if (createLegacyImportDataFingerprint(data) !== previewFingerprint) return null;
  return prepareLegacyImportData(data, createId);
}

export function createLegacyImportDataFingerprint(data: DeKoiLegacyImportData) {
  return createDeKoiStorageBundleFingerprint(
    createDeKoiStorageBundle({
      appSettings: DEFAULT_APP_SETTINGS,
      characters: data.characters,
      modeThreads: data.modeThreads,
      personas: data.personas,
      lorebooks: [],
      promptPresets: [],
      loreRuntimeStates: [],
      macroVariableStates: data.macroVariableStates,
      providerConnections: data.providerConnections,
      rippleStates: [],
    }),
    { messengerThreadMacroVariableStates: data.messengerThreadMacroVariableStates },
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
  modeThreads,
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
        modeThreads,
        lorebooks,
        promptPresets,
        loreRuntimeStates,
        macroVariableStates,
        personas,
        providerConnections,
        rippleStates,
      }),
    [
      appSettings,
      characters,
      lorebooks,
      promptPresets,
      loreRuntimeStates,
      macroVariableStates,
      modeThreads,
      personas,
      providerConnections,
      rippleStates,
    ],
  );

  const importStorageBundle = useCallback(
    async (bundle: DeKoiStorageBundle, options: ImportCommitOptions) => {
      const importedConnections = bundle.data.providerConnections;
      const importedModeThreads = assembleModeThreads(
        bundle.data.modeThreads,
        bundle.data.modeMessages,
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
        modeThreads: importedModeThreads,
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
      const preparedData = verifyAndPrepareLegacyImportData(data, options.previewFingerprint);
      if (!preparedData) {
        const previewRecords: AppStorageRecords = {
          appSettings,
          characters,
          personas,
          lorebooks,
          promptPresets,
          loreRuntimeStates,
          macroVariableStates,
          providerConnections,
          modeThreads,
          rippleStates,
        };
        return createImportActionErrorResult(
          previewRecords,
          "Legacy import preview no longer matches the converted records to commit. Preview the file again before importing.",
        );
      }

      const firstImportedThreadId = preparedData.modeThreads[0]?.id ?? null;
      const importedRecords: AppStorageRecords = {
        appSettings,
        characters: [...preparedData.characters, ...characters],
        personas: [...preparedData.personas, ...personas],
        lorebooks,
        promptPresets,
        loreRuntimeStates,
        macroVariableStates: mergeLegacyImportMacroVariableStates(
          preparedData.macroVariableStates,
          macroVariableStates,
        ),
        providerConnections: [...preparedData.providerConnections, ...providerConnections],
        modeThreads: [...preparedData.modeThreads, ...modeThreads],
        rippleStates,
      };

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
      modeThreads,
      personas,
      providerConnections,
      rippleStates,
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
