import { useState, type ChangeEvent, type FormEvent } from "react";
import type { NavContextType } from "../../../shared/ui/nav-context";
import { Switch } from "../../../shared/ui/primitives/Switch";
import { Slider } from "../../../shared/ui/primitives/Slider";
import { Seg } from "../../../shared/ui/primitives/Seg";
import { CLASSIC, MESSENGER, RESERVED } from "../../../engine/surfaces";
import type { CharacterRecord } from "../../../engine/character";
import type { LorebookEntryRecord } from "../../../engine/lorebook";
import type { PersonaRecord } from "../../../engine/persona";
import type {
  ProviderConnectionKind,
  ProviderConnectionRecord,
} from "../../../engine/provider-connection";
import {
  getDeKoiStorageBundleCounts,
  normalizeDeKoiStorageBundle,
  type DeKoiStorageBundleCounts,
  type DeKoiStorageBundlePreview,
} from "../../../runtime/dekoi-storage-bundle";
import {
  checkDesktopHostStatus,
  deleteDesktopProviderSecret,
  exportDesktopBundleFile,
  getDesktopProviderSecretStatus,
  importDesktopBundleFile,
  readDesktopStorageBundle,
  writeDesktopProviderSecret,
  writeDesktopStorageBundle,
  type DeKoiDesktopProviderSecretStatus,
  type DeKoiDesktopHostStatus,
} from "../../../runtime/desktop-host";
import {
  normalizeLegacyImport,
  type DeKoiLegacyImportPreview,
} from "../../../runtime/legacy-import";
import { checkRemoteRuntimeHealth } from "../../../runtime/remote-runtime";
import "./CareDrawer.css";
import "./care-fields.css";

interface CareDrawerProps {
  nav: NavContextType;
}

// Tab labels + their short descriptor. Water, Catalog, and Deep Water are live;
// the remaining tabs keep lightweight placeholders until their surfaces exist.
const CARE_TABS = [
  { label: "Water", hint: "general" },
  { label: "Light", hint: "look" },
  { label: "Season", hint: "themes" },
  { label: "Habitat", hint: "modules" },
  { label: "Catalog", hint: "records" },
  { label: "Stocking", hint: "import" },
  { label: "Vitals", hint: "health" },
  { label: "Deep water", hint: "advanced" },
] as const;

// DeKoi-native surface ids for the Send-on-Enter segmented control.
const SEND_ON_ENTER_SURFACES = [
  { value: CLASSIC, label: "Classic" },
  { value: MESSENGER, label: "Messenger" },
  { value: RESERVED, label: "Reserved" },
] as const;

interface CharacterDraft {
  displayName: string;
  shortName: string;
  summary: string;
  description: string;
  avatarUrl: string;
}

interface PersonaDraft {
  displayName: string;
  summary: string;
  description: string;
  avatarUrl: string;
}

interface LoreEntryDraft {
  title: string;
  body: string;
  enabled: boolean;
}

interface ProviderConnectionDraft {
  kind: ProviderConnectionKind;
  label: string;
  summary: string;
  modelLabel: string;
}

const EMPTY_CHARACTER_DRAFT: CharacterDraft = {
  displayName: "",
  shortName: "",
  summary: "",
  description: "",
  avatarUrl: "",
};

const EMPTY_PERSONA_DRAFT: PersonaDraft = {
  displayName: "",
  summary: "",
  description: "",
  avatarUrl: "",
};

const EMPTY_LORE_ENTRY_DRAFT: LoreEntryDraft = {
  title: "",
  body: "",
  enabled: true,
};

const EMPTY_CONNECTION_DRAFT: ProviderConnectionDraft = {
  kind: "mock",
  label: "",
  summary: "",
  modelLabel: "",
};

function characterDraftFrom(record: CharacterRecord): CharacterDraft {
  return {
    displayName: record.displayName,
    shortName: record.shortName ?? "",
    summary: record.summary,
    description: record.description,
    avatarUrl: record.avatarUrl ?? "",
  };
}

function personaDraftFrom(record: PersonaRecord): PersonaDraft {
  return {
    displayName: record.displayName,
    summary: record.summary,
    description: record.description,
    avatarUrl: record.avatarUrl ?? "",
  };
}

function loreEntryDraftFrom(record: LorebookEntryRecord): LoreEntryDraft {
  return {
    title: record.title,
    body: record.body,
    enabled: record.enabled,
  };
}

function connectionDraftFrom(
  record: ProviderConnectionRecord,
): ProviderConnectionDraft {
  return {
    kind: record.kind,
    label: record.label,
    summary: record.summary,
    modelLabel: record.modelLabel ?? "",
  };
}

export function CareDrawer({ nav }: CareDrawerProps) {
  const open = nav.careOpen;
  const activeLorebook = nav.lorebooks[0] ?? null;
  const messengerConnectionOptions = nav.providerConnections.map((connection) => ({
    value: connection.id,
    label: connection.label,
  }));

  // Local-only visual/demo settings. Product settings live in nav.appSettings.
  const [streamReplies, setStreamReplies] = useState(true);
  const [spotifyPlayer, setSpotifyPlayer] = useState(false);
  const [rippleSpeed, setRippleSpeed] = useState(50);
  const [surfaceAllText, setSurfaceAllText] = useState(false);
  const [wheelNavigate, setWheelNavigate] = useState(false);
  const [narrationDrift, setNarrationDrift] = useState(50);
  const [autoplayPause, setAutoplayPause] = useState(30);
  const [runtimeUrl, setRuntimeUrl] = useState(nav.remoteRuntimeUrl);
  const [runtimeHealth, setRuntimeHealth] = useState("");
  const [desktopHostStatus, setDesktopHostStatus] =
    useState<DeKoiDesktopHostStatus | null>(null);
  const [desktopHostBusy, setDesktopHostBusy] = useState(false);
  const [desktopStorageBusy, setDesktopStorageBusy] = useState(false);
  const [desktopStorageStatus, setDesktopStorageStatus] = useState("");
  const [editingCharacterId, setEditingCharacterId] = useState<string | null>(
    null,
  );
  const [characterDraft, setCharacterDraft] = useState<CharacterDraft>(
    EMPTY_CHARACTER_DRAFT,
  );
  const [editingPersonaId, setEditingPersonaId] = useState<string | null>(null);
  const [personaDraft, setPersonaDraft] =
    useState<PersonaDraft>(EMPTY_PERSONA_DRAFT);
  const [editingLoreEntryId, setEditingLoreEntryId] = useState<string | null>(
    null,
  );
  const [loreEntryDraft, setLoreEntryDraft] = useState<LoreEntryDraft>(
    EMPTY_LORE_ENTRY_DRAFT,
  );
  const [editingConnectionId, setEditingConnectionId] = useState<string | null>(
    null,
  );
  const [connectionDraft, setConnectionDraft] =
    useState<ProviderConnectionDraft>(EMPTY_CONNECTION_DRAFT);
  const [connectionSecretInput, setConnectionSecretInput] = useState("");
  const [connectionSecretBusy, setConnectionSecretBusy] = useState(false);
  const [connectionSecretStatus, setConnectionSecretStatus] = useState("");
  const [connectionSecrets, setConnectionSecrets] = useState<
    Record<string, DeKoiDesktopProviderSecretStatus>
  >({});
  const [bundlePreview, setBundlePreview] =
    useState<DeKoiStorageBundlePreview | null>(null);
  const [bundleReplaceConfirmed, setBundleReplaceConfirmed] = useState(false);
  const [bundleStatus, setBundleStatus] = useState("");
  const [desktopFileBusy, setDesktopFileBusy] = useState(false);
  const [legacyPreview, setLegacyPreview] =
    useState<DeKoiLegacyImportPreview | null>(null);
  const [legacyImportConfirmed, setLegacyImportConfirmed] = useState(false);
  const [legacyStatus, setLegacyStatus] = useState("");
  const runtimeStatusMessage = runtimeHealth || nav.messengerStorageMessage;
  const currentBundleCounts = getDeKoiStorageBundleCounts({
    appSettings: nav.appSettings,
    characters: nav.characters,
    classicThreads: nav.classicThreads,
    lorebooks: nav.lorebooks,
    messengerThreads: nav.messengerThreads,
    personas: nav.personas,
    providerConnections: nav.providerConnections,
  });

  function handleRuntimeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRuntimeHealth("");
    nav.setRemoteRuntimeUrl(runtimeUrl);
  }

  async function handleRuntimeTest() {
    setRuntimeHealth("Checking remote runtime...");
    const health = await checkRemoteRuntimeHealth(runtimeUrl);
    setRuntimeHealth(health.message);
  }

  function handleUseLocalStorage() {
    setRuntimeUrl("");
    nav.setRemoteRuntimeUrl("");
    setRuntimeHealth("Saved locally.");
  }

  async function handleDesktopHostCheck() {
    setDesktopHostBusy(true);
    setDesktopHostStatus({
      appName: "DeKoi",
      hostKind: "browser",
      storageReady: false,
      secretsReady: false,
      runtimeReady: false,
      message: "Checking desktop host...",
    });
    const status = await checkDesktopHostStatus();
    setDesktopHostStatus(status);
    setDesktopHostBusy(false);
  }

  function formatBytes(byteLength: number) {
    if (byteLength < 1024) return `${byteLength} B`;
    return `${(byteLength / 1024).toFixed(1)} KB`;
  }

  async function refreshDesktopHostStatus() {
    const status = await checkDesktopHostStatus();
    setDesktopHostStatus(status);
    return status;
  }

  async function handleDesktopStorageSave() {
    setDesktopStorageBusy(true);
    setDesktopStorageStatus("Saving desktop host bundle...");

    try {
      const info = await writeDesktopStorageBundle(nav.createStorageBundle());
      await refreshDesktopHostStatus();
      setDesktopStorageStatus(
        `Saved desktop host bundle (${formatBytes(info.byteLength)}).`,
      );
    } catch (error) {
      setDesktopStorageStatus(
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setDesktopStorageBusy(false);
    }
  }

  async function handleDesktopStorageLoad() {
    setDesktopStorageBusy(true);
    setDesktopStorageStatus("Loading desktop host bundle...");

    try {
      const result = await readDesktopStorageBundle();
      if (!result.ok) {
        setDesktopStorageStatus(result.error);
        return;
      }

      nav.importStorageBundle(result.bundle);
      await refreshDesktopHostStatus();
      setDesktopStorageStatus(
        result.warnings.length > 0
          ? `Loaded desktop host bundle with ${result.warnings.length} warning(s).`
          : `Loaded desktop host bundle (${formatBytes(result.info.byteLength)}).`,
      );
    } catch (error) {
      setDesktopStorageStatus(
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setDesktopStorageBusy(false);
    }
  }

  function resetCharacterDraft() {
    setEditingCharacterId(null);
    setCharacterDraft(EMPTY_CHARACTER_DRAFT);
  }

  function handleCharacterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editingCharacterId) {
      nav.updateCharacter(editingCharacterId, characterDraft);
      return;
    }

    const character = nav.createCharacter(characterDraft);
    setEditingCharacterId(character.id);
    setCharacterDraft(characterDraftFrom(character));
  }

  function editCharacter(character: CharacterRecord) {
    setEditingCharacterId(character.id);
    setCharacterDraft(characterDraftFrom(character));
  }

  function copyCharacter(characterId: string) {
    const character = nav.duplicateCharacter(characterId);
    if (!character) return;
    editCharacter(character);
  }

  function removeCharacter(characterId: string) {
    nav.deleteCharacter(characterId);
    if (editingCharacterId === characterId) resetCharacterDraft();
  }

  function resetPersonaDraft() {
    setEditingPersonaId(null);
    setPersonaDraft(EMPTY_PERSONA_DRAFT);
  }

  function handlePersonaSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editingPersonaId) {
      nav.updatePersona(editingPersonaId, personaDraft);
      return;
    }

    const persona = nav.createPersona(personaDraft);
    setEditingPersonaId(persona.id);
    setPersonaDraft(personaDraftFrom(persona));
  }

  function editPersona(persona: PersonaRecord) {
    setEditingPersonaId(persona.id);
    setPersonaDraft(personaDraftFrom(persona));
  }

  function copyPersona(personaId: string) {
    const persona = nav.duplicatePersona(personaId);
    if (!persona) return;
    editPersona(persona);
  }

  function removePersona(personaId: string) {
    nav.deletePersona(personaId);
    if (editingPersonaId === personaId) resetPersonaDraft();
  }

  function resetLoreEntryDraft() {
    setEditingLoreEntryId(null);
    setLoreEntryDraft(EMPTY_LORE_ENTRY_DRAFT);
  }

  function handleLoreEntrySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeLorebook) return;

    if (editingLoreEntryId) {
      nav.updateLorebookEntry(
        activeLorebook.id,
        editingLoreEntryId,
        loreEntryDraft,
      );
      return;
    }

    const entry = nav.createLorebookEntry(activeLorebook.id, loreEntryDraft);
    if (!entry) return;
    setEditingLoreEntryId(entry.id);
    setLoreEntryDraft(loreEntryDraftFrom(entry));
  }

  function editLoreEntry(entry: LorebookEntryRecord) {
    setEditingLoreEntryId(entry.id);
    setLoreEntryDraft(loreEntryDraftFrom(entry));
  }

  function copyLoreEntry(entryId: string) {
    if (!activeLorebook) return;
    const entry = nav.duplicateLorebookEntry(activeLorebook.id, entryId);
    if (!entry) return;
    editLoreEntry(entry);
  }

  function removeLoreEntry(entryId: string) {
    if (!activeLorebook) return;
    nav.deleteLorebookEntry(activeLorebook.id, entryId);
    if (editingLoreEntryId === entryId) resetLoreEntryDraft();
  }

  function resetConnectionDraft() {
    setEditingConnectionId(null);
    setConnectionDraft(EMPTY_CONNECTION_DRAFT);
    setConnectionSecretInput("");
    setConnectionSecretStatus("");
  }

  function handleConnectionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editingConnectionId) {
      nav.updateProviderConnection(editingConnectionId, connectionDraft);
      return;
    }

    const connection = nav.createProviderConnection(connectionDraft);
    setEditingConnectionId(connection.id);
    setConnectionDraft(connectionDraftFrom(connection));
    setConnectionSecretInput("");
    setConnectionSecretStatus("");
  }

  function editConnection(connection: ProviderConnectionRecord) {
    setEditingConnectionId(connection.id);
    setConnectionDraft(connectionDraftFrom(connection));
    setConnectionSecretInput("");
    setConnectionSecretStatus("");
  }

  function copyConnection(connectionId: string) {
    const connection = nav.duplicateProviderConnection(connectionId);
    if (!connection) return;
    editConnection(connection);
  }

  function removeConnection(connectionId: string) {
    nav.deleteProviderConnection(connectionId);
    setConnectionSecrets((currentSecrets) => {
      const remainingSecrets = { ...currentSecrets };
      delete remainingSecrets[connectionId];
      return remainingSecrets;
    });
    void deleteDesktopProviderSecret(connectionId).catch(() => undefined);
    if (editingConnectionId === connectionId) resetConnectionDraft();
  }

  function updateConnectionSecretStatus(
    status: DeKoiDesktopProviderSecretStatus,
  ) {
    setConnectionSecrets((currentSecrets) => ({
      ...currentSecrets,
      [status.connectionId]: status,
    }));
  }

  async function handleConnectionSecretCheck(
    connectionId = editingConnectionId,
  ) {
    if (!connectionId) {
      setConnectionSecretStatus("Save the connection before managing its key.");
      return;
    }

    setConnectionSecretBusy(true);
    setConnectionSecretStatus("Checking provider key...");

    try {
      const status = await getDesktopProviderSecretStatus(connectionId);
      updateConnectionSecretStatus(status);
      setConnectionSecretStatus(
        status.hasSecret
          ? "Provider key is saved in the desktop host."
          : "No provider key is saved for this connection.",
      );
    } catch (error) {
      setConnectionSecretStatus(
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setConnectionSecretBusy(false);
    }
  }

  async function handleConnectionSecretSave() {
    if (!editingConnectionId) {
      setConnectionSecretStatus("Save the connection before managing its key.");
      return;
    }

    setConnectionSecretBusy(true);
    setConnectionSecretStatus("Saving provider key...");

    try {
      const status = await writeDesktopProviderSecret(
        editingConnectionId,
        connectionSecretInput,
      );
      updateConnectionSecretStatus(status);
      setConnectionSecretInput("");
      await refreshDesktopHostStatus();
      setConnectionSecretStatus("Provider key saved in the desktop host.");
    } catch (error) {
      setConnectionSecretStatus(
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setConnectionSecretBusy(false);
    }
  }

  async function handleConnectionSecretClear() {
    if (!editingConnectionId) {
      setConnectionSecretStatus("Save the connection before managing its key.");
      return;
    }

    setConnectionSecretBusy(true);
    setConnectionSecretStatus("Clearing provider key...");

    try {
      const status = await deleteDesktopProviderSecret(editingConnectionId);
      updateConnectionSecretStatus(status);
      setConnectionSecretInput("");
      await refreshDesktopHostStatus();
      setConnectionSecretStatus("Provider key cleared.");
    } catch (error) {
      setConnectionSecretStatus(
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setConnectionSecretBusy(false);
    }
  }

  function getBundleFilename() {
    return `dekoi-bundle-${new Date().toISOString().slice(0, 10)}.json`;
  }

  function handleBundleExport() {
    const bundle = nav.createStorageBundle();
    const blob = new Blob([JSON.stringify(bundle, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = getBundleFilename();
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setBundleStatus("Exported a DeKoi JSON bundle.");
  }

  async function handleDesktopBundleExport() {
    setDesktopFileBusy(true);
    setBundleStatus("Opening desktop save dialog...");

    try {
      const info = await exportDesktopBundleFile(
        nav.createStorageBundle(),
        getBundleFilename(),
      );
      setBundleStatus(
        info
          ? `Exported desktop bundle (${formatBytes(info.byteLength)}).`
          : "Desktop export cancelled.",
      );
    } catch (error) {
      setBundleStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setDesktopFileBusy(false);
    }
  }

  async function handleBundleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    setBundleStatus("");
    setBundlePreview(null);
    setBundleReplaceConfirmed(false);

    if (!file) return;

    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const result = normalizeDeKoiStorageBundle(parsed);
      if (!result.ok) {
        setBundleStatus(result.error);
        return;
      }

      setBundlePreview(result.preview);
      setBundleStatus(`Previewing ${file.name}.`);
    } catch {
      setBundleStatus("Import file must be valid JSON.");
    } finally {
      input.value = "";
    }
  }

  function handleBundleImport() {
    if (!bundlePreview) return;
    if (!bundleReplaceConfirmed) {
      setBundleStatus("Confirm replacement before importing.");
      return;
    }

    nav.importStorageBundle(bundlePreview.bundle);
    setBundleStatus("Imported DeKoi bundle.");
    setBundlePreview(null);
    setBundleReplaceConfirmed(false);
  }

  async function handleDesktopBundleFileImport() {
    setDesktopFileBusy(true);
    setBundleStatus("Opening desktop import dialog...");
    setBundlePreview(null);
    setBundleReplaceConfirmed(false);

    try {
      const result = await importDesktopBundleFile();
      if (!result.ok) {
        setBundleStatus(
          result.cancelled ? "Desktop import cancelled." : result.error,
        );
        return;
      }

      setBundlePreview({
        bundle: result.bundle,
        counts: getDeKoiStorageBundleCounts(result.bundle.data),
        warnings: result.warnings,
      });
      setBundleStatus(
        `Previewing desktop bundle (${formatBytes(result.info.byteLength)}).`,
      );
    } catch (error) {
      setBundleStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setDesktopFileBusy(false);
    }
  }

  async function handleLegacyFileChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    setLegacyStatus("");
    setLegacyPreview(null);
    setLegacyImportConfirmed(false);

    if (!file) return;

    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const result = normalizeLegacyImport(parsed);
      if (!result.ok) {
        setLegacyStatus(result.error);
        return;
      }

      setLegacyPreview(result.preview);
      setLegacyStatus(`Previewing ${file.name}.`);
    } catch {
      setLegacyStatus("Legacy import file must be valid JSON.");
    } finally {
      input.value = "";
    }
  }

  function handleLegacyImport() {
    if (!legacyPreview) return;
    if (!legacyImportConfirmed) {
      setLegacyStatus("Confirm import before adding converted records.");
      return;
    }

    nav.importLegacyData(legacyPreview.data);
    setLegacyStatus("Imported converted legacy threads.");
    setLegacyPreview(null);
    setLegacyImportConfirmed(false);
  }

  function renderBundleCounts(counts: DeKoiStorageBundleCounts) {
    return (
      <div className="bundle-counts">
        <span>
          <b>{counts.characters}</b> companions
        </span>
        <span>
          <b>{counts.personas}</b> personas
        </span>
        <span>
          <b>{counts.classicThreads}</b> Classic scenes
        </span>
        <span>
          <b>{counts.classicEntries}</b> Classic turns
        </span>
        <span>
          <b>{counts.lorebooks}</b> lorebooks
        </span>
        <span>
          <b>{counts.lorebookEntries}</b> lore entries
        </span>
        <span>
          <b>{counts.providerConnections}</b> connections
        </span>
        <span>
          <b>{counts.messengerThreads}</b> threads
        </span>
        <span>
          <b>{counts.messengerMessages}</b> messages
        </span>
      </div>
    );
  }

  function renderLegacyPreview(preview: DeKoiLegacyImportPreview) {
    return (
      <div className="bundle-preview">
        <b>Legacy import preview</b>
        <div className="bundle-counts">
          <span>
            <b>{preview.counts.messengerThreads}</b> Messenger threads
          </span>
          <span>
            <b>{preview.counts.messengerMessages}</b> messages
          </span>
        </div>
        <p className="bundle-note">Source: {preview.data.sourceLabel}</p>
        {preview.warnings.length > 0 && (
          <div className="bundle-warnings">
            {preview.warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        )}
        <label className="catalog-check bundle-confirm">
          <input
            type="checkbox"
            checked={legacyImportConfirmed}
            onChange={(event) => setLegacyImportConfirmed(event.target.checked)}
          />
          Add converted records to DeKoi
        </label>
      </div>
    );
  }

  function renderStockingTools() {
    return (
      <div className="bundle-panel">
        <p className="care-intro">
          Export and import DeKoi-native records as a readable JSON bundle.
        </p>

        <section className="bundle-section" aria-labelledby="bundle-export">
          <div className="catalog-section-head">
            <div>
              <h3 id="bundle-export">Export</h3>
              <span>current pond</span>
            </div>
            <button type="button" onClick={handleBundleExport}>
              Export JSON
            </button>
          </div>
          {renderBundleCounts(currentBundleCounts)}
          <div className="runtime-actions">
            <button
              type="button"
              disabled={desktopFileBusy}
              onClick={handleDesktopBundleExport}
            >
              Export desktop file
            </button>
          </div>
          <p className="bundle-note">
            Remote Runtime URL and credentials are not included.
          </p>
        </section>

        <section className="bundle-section" aria-labelledby="bundle-import">
          <div className="catalog-section-head">
            <div>
              <h3 id="bundle-import">Import</h3>
              <span>replace current records</span>
            </div>
          </div>

          <div className="field">
            <label htmlFor="dekoi-bundle-file">DeKoi JSON bundle</label>
            <input
              className="pondinput"
              id="dekoi-bundle-file"
              type="file"
              accept="application/json,.json"
              onChange={handleBundleFileChange}
            />
            <div className="help">
              Import previews counts before anything is changed.
            </div>
          </div>

          <div className="runtime-actions">
            <button
              type="button"
              disabled={desktopFileBusy}
              onClick={handleDesktopBundleFileImport}
            >
              Open desktop file
            </button>
          </div>

          {bundlePreview && (
            <div className="bundle-preview">
              <b>Import preview</b>
              {renderBundleCounts(bundlePreview.counts)}
              {bundlePreview.warnings.length > 0 && (
                <div className="bundle-warnings">
                  {bundlePreview.warnings.map((warning) => (
                    <p key={warning}>{warning}</p>
                  ))}
                </div>
              )}
              <label className="catalog-check bundle-confirm">
                <input
                  type="checkbox"
                  checked={bundleReplaceConfirmed}
                  onChange={(event) =>
                    setBundleReplaceConfirmed(event.target.checked)
                  }
                />
                Replace current DeKoi records with this bundle
              </label>
            </div>
          )}

          {bundleStatus && <p className="bundle-status">{bundleStatus}</p>}

          <div className="runtime-actions">
            <button
              type="button"
              disabled={!bundlePreview || !bundleReplaceConfirmed}
              onClick={handleBundleImport}
            >
              Import bundle
            </button>
          </div>
        </section>

        <section className="bundle-section" aria-labelledby="legacy-import">
          <div className="catalog-section-head">
            <div>
              <h3 id="legacy-import">Legacy import</h3>
              <span>add converted threads</span>
            </div>
          </div>

          <div className="field">
            <label htmlFor="legacy-thread-file">Legacy thread JSON</label>
            <input
              className="pondinput"
              id="legacy-thread-file"
              type="file"
              accept="application/json,.json"
              onChange={handleLegacyFileChange}
            />
            <div className="help">
              Supports previous thread exports and localStorage-style thread
              dumps. Converted records are added as native Messenger threads.
            </div>
          </div>

          {legacyPreview && renderLegacyPreview(legacyPreview)}
          {legacyStatus && <p className="bundle-status">{legacyStatus}</p>}

          <div className="runtime-actions">
            <button
              type="button"
              disabled={!legacyPreview || !legacyImportConfirmed}
              onClick={handleLegacyImport}
            >
              Import converted records
            </button>
          </div>
        </section>
      </div>
    );
  }

  function renderCatalogManager() {
    return (
      <div className="catalog-panel">
        <section className="catalog-section" aria-labelledby="catalog-companions">
          <div className="catalog-section-head">
            <div>
              <h3 id="catalog-companions">Companions</h3>
              <span>{nav.characters.length} stocked</span>
            </div>
            <button type="button" onClick={resetCharacterDraft}>
              New
            </button>
          </div>

          <div className="catalog-list">
            {nav.characters.map((character) => (
              <article className="catalog-row" key={character.id}>
                <span>
                  <b>{character.displayName}</b>
                  <small>{character.summary || "No summary."}</small>
                </span>
                <span className="catalog-actions">
                  <button type="button" onClick={() => editCharacter(character)}>
                    Edit
                  </button>
                  <button type="button" onClick={() => copyCharacter(character.id)}>
                    Copy
                  </button>
                  <button
                    type="button"
                    onClick={() => removeCharacter(character.id)}
                  >
                    Delete
                  </button>
                </span>
              </article>
            ))}
            {nav.characters.length === 0 && (
              <p className="catalog-empty">No companions stocked.</p>
            )}
          </div>

          <form className="catalog-form" onSubmit={handleCharacterSubmit}>
            <div className="field">
              <label htmlFor="character-display-name">Display name</label>
              <input
                className="pondinput"
                id="character-display-name"
                value={characterDraft.displayName}
                onChange={(event) =>
                  setCharacterDraft((draft) => ({
                    ...draft,
                    displayName: event.target.value,
                  }))
                }
              />
            </div>
            <div className="field">
              <label htmlFor="character-short-name">Short name</label>
              <input
                className="pondinput"
                id="character-short-name"
                value={characterDraft.shortName}
                onChange={(event) =>
                  setCharacterDraft((draft) => ({
                    ...draft,
                    shortName: event.target.value,
                  }))
                }
              />
            </div>
            <div className="field">
              <label htmlFor="character-summary">Summary</label>
              <input
                className="pondinput"
                id="character-summary"
                value={characterDraft.summary}
                onChange={(event) =>
                  setCharacterDraft((draft) => ({
                    ...draft,
                    summary: event.target.value,
                  }))
                }
              />
            </div>
            <div className="field">
              <label htmlFor="character-description">Description</label>
              <textarea
                className="pondarea"
                id="character-description"
                value={characterDraft.description}
                onChange={(event) =>
                  setCharacterDraft((draft) => ({
                    ...draft,
                    description: event.target.value,
                  }))
                }
              />
            </div>
            <div className="runtime-actions">
              <button type="submit">
                {editingCharacterId ? "Save companion" : "Create companion"}
              </button>
            </div>
          </form>
        </section>

        <section className="catalog-section" aria-labelledby="catalog-personas">
          <div className="catalog-section-head">
            <div>
              <h3 id="catalog-personas">Personas</h3>
              <span>{nav.personas.length} stocked</span>
            </div>
            <button type="button" onClick={resetPersonaDraft}>
              New
            </button>
          </div>

          <div className="catalog-list">
            {nav.personas.map((persona) => (
              <article className="catalog-row" key={persona.id}>
                <span>
                  <b>{persona.displayName}</b>
                  <small>{persona.summary || "No summary."}</small>
                </span>
                <span className="catalog-actions">
                  <button type="button" onClick={() => editPersona(persona)}>
                    Edit
                  </button>
                  <button type="button" onClick={() => copyPersona(persona.id)}>
                    Copy
                  </button>
                  <button type="button" onClick={() => removePersona(persona.id)}>
                    Delete
                  </button>
                </span>
              </article>
            ))}
            {nav.personas.length === 0 && (
              <p className="catalog-empty">No personas stocked.</p>
            )}
          </div>

          <form className="catalog-form" onSubmit={handlePersonaSubmit}>
            <div className="field">
              <label htmlFor="persona-display-name">Display name</label>
              <input
                className="pondinput"
                id="persona-display-name"
                value={personaDraft.displayName}
                onChange={(event) =>
                  setPersonaDraft((draft) => ({
                    ...draft,
                    displayName: event.target.value,
                  }))
                }
              />
            </div>
            <div className="field">
              <label htmlFor="persona-summary">Summary</label>
              <input
                className="pondinput"
                id="persona-summary"
                value={personaDraft.summary}
                onChange={(event) =>
                  setPersonaDraft((draft) => ({
                    ...draft,
                    summary: event.target.value,
                  }))
                }
              />
            </div>
            <div className="field">
              <label htmlFor="persona-description">Description</label>
              <textarea
                className="pondarea"
                id="persona-description"
                value={personaDraft.description}
                onChange={(event) =>
                  setPersonaDraft((draft) => ({
                    ...draft,
                    description: event.target.value,
                  }))
                }
              />
            </div>
            <div className="runtime-actions">
              <button type="submit">
                {editingPersonaId ? "Save persona" : "Create persona"}
              </button>
            </div>
          </form>
        </section>

        <section className="catalog-section" aria-labelledby="catalog-lore">
          <div className="catalog-section-head">
            <div>
              <h3 id="catalog-lore">
                {activeLorebook?.title ?? "Lorebook entries"}
              </h3>
              <span>{activeLorebook?.entries.length ?? 0} entries</span>
            </div>
            <button
              type="button"
              onClick={resetLoreEntryDraft}
              disabled={!activeLorebook}
            >
              New
            </button>
          </div>

          <div className="catalog-list">
            {activeLorebook?.entries.map((entry) => (
              <article className="catalog-row" key={entry.id}>
                <span>
                  <b>{entry.title}</b>
                  <small>{entry.enabled ? entry.body : "Disabled"}</small>
                </span>
                <span className="catalog-actions">
                  <button type="button" onClick={() => editLoreEntry(entry)}>
                    Edit
                  </button>
                  <button type="button" onClick={() => copyLoreEntry(entry.id)}>
                    Copy
                  </button>
                  <button type="button" onClick={() => removeLoreEntry(entry.id)}>
                    Delete
                  </button>
                </span>
              </article>
            ))}
            {(!activeLorebook || activeLorebook.entries.length === 0) && (
              <p className="catalog-empty">No lore entries stocked.</p>
            )}
          </div>

          <form className="catalog-form" onSubmit={handleLoreEntrySubmit}>
            <div className="field">
              <label htmlFor="lore-entry-title">Title</label>
              <input
                className="pondinput"
                id="lore-entry-title"
                disabled={!activeLorebook}
                value={loreEntryDraft.title}
                onChange={(event) =>
                  setLoreEntryDraft((draft) => ({
                    ...draft,
                    title: event.target.value,
                  }))
                }
              />
            </div>
            <div className="field">
              <label htmlFor="lore-entry-body">Body</label>
              <textarea
                className="pondarea"
                id="lore-entry-body"
                disabled={!activeLorebook}
                value={loreEntryDraft.body}
                onChange={(event) =>
                  setLoreEntryDraft((draft) => ({
                    ...draft,
                    body: event.target.value,
                  }))
                }
              />
            </div>
            <label className="catalog-check">
              <input
                type="checkbox"
                checked={loreEntryDraft.enabled}
                onChange={(event) =>
                  setLoreEntryDraft((draft) => ({
                    ...draft,
                    enabled: event.target.checked,
                  }))
                }
              />
              Enabled
            </label>
            <div className="runtime-actions">
              <button type="submit" disabled={!activeLorebook}>
                {editingLoreEntryId ? "Save entry" : "Create entry"}
              </button>
            </div>
          </form>
        </section>

        <section className="catalog-section" aria-labelledby="catalog-connections">
          <div className="catalog-section-head">
            <div>
              <h3 id="catalog-connections">Connections</h3>
              <span>{nav.providerConnections.length} stocked</span>
            </div>
            <button type="button" onClick={resetConnectionDraft}>
              New
            </button>
          </div>

          <div className="catalog-list">
            {nav.providerConnections.map((connection) => (
              <article className="catalog-row" key={connection.id}>
                <span>
                  <b>{connection.label}</b>
                  <small>
                    {connection.summary || connection.kind}
                    {connectionSecrets[connection.id]?.hasSecret
                      ? " · key saved"
                      : ""}
                  </small>
                </span>
                <span className="catalog-actions">
                  <button type="button" onClick={() => editConnection(connection)}>
                    Edit
                  </button>
                  <button type="button" onClick={() => copyConnection(connection.id)}>
                    Copy
                  </button>
                  <button
                    type="button"
                    disabled={nav.providerConnections.length <= 1}
                    onClick={() => removeConnection(connection.id)}
                  >
                    Delete
                  </button>
                </span>
              </article>
            ))}
          </div>

          <form className="catalog-form" onSubmit={handleConnectionSubmit}>
            <div className="field">
              <label htmlFor="connection-kind">Kind</label>
              <select
                className="pondsel"
                id="connection-kind"
                value={connectionDraft.kind}
                onChange={(event) =>
                  setConnectionDraft((draft) => ({
                    ...draft,
                    kind: event.target.value as ProviderConnectionKind,
                  }))
                }
              >
                <option value="mock">Mock</option>
                <option value="remote-runtime">Remote runtime</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="connection-label">Label</label>
              <input
                className="pondinput"
                id="connection-label"
                value={connectionDraft.label}
                onChange={(event) =>
                  setConnectionDraft((draft) => ({
                    ...draft,
                    label: event.target.value,
                  }))
                }
              />
            </div>
            <div className="field">
              <label htmlFor="connection-summary">Summary</label>
              <input
                className="pondinput"
                id="connection-summary"
                value={connectionDraft.summary}
                onChange={(event) =>
                  setConnectionDraft((draft) => ({
                    ...draft,
                    summary: event.target.value,
                  }))
                }
              />
            </div>
            <div className="field">
              <label htmlFor="connection-model">Model label</label>
              <input
                className="pondinput"
                id="connection-model"
                value={connectionDraft.modelLabel}
                onChange={(event) =>
                  setConnectionDraft((draft) => ({
                    ...draft,
                    modelLabel: event.target.value,
                  }))
                }
              />
            </div>

            <div className="field">
              <label htmlFor="connection-secret">Provider key</label>
              <input
                className="pondinput"
                id="connection-secret"
                type="password"
                autoComplete="off"
                placeholder={
                  editingConnectionId
                    ? "Stored only in the desktop host"
                    : "Save the connection first"
                }
                value={connectionSecretInput}
                onChange={(event) =>
                  setConnectionSecretInput(event.target.value)
                }
                disabled={!editingConnectionId || connectionSecretBusy}
              />
              <div className="help">
                Keys are not saved in DeKoi bundles or browser storage.
              </div>
            </div>

            <div className="runtime-actions">
              <button
                type="button"
                disabled={!editingConnectionId || connectionSecretBusy}
                onClick={() => handleConnectionSecretCheck()}
              >
                Check key
              </button>
              <button
                type="button"
                disabled={
                  !editingConnectionId ||
                  connectionSecretBusy ||
                  !connectionSecretInput.trim()
                }
                onClick={handleConnectionSecretSave}
              >
                Save key
              </button>
              <button
                type="button"
                disabled={!editingConnectionId || connectionSecretBusy}
                onClick={handleConnectionSecretClear}
              >
                Clear key
              </button>
            </div>

            {connectionSecretStatus && (
              <p className="bundle-status">{connectionSecretStatus}</p>
            )}

            <div className="runtime-actions">
              <button type="submit">
                {editingConnectionId ? "Save connection" : "Create connection"}
              </button>
            </div>
          </form>
        </section>
      </div>
    );
  }

  return (
    <>
      <div
        className={`scrim${open ? " open" : ""}`}
        onClick={() => nav.setCareOpen(false)}
        aria-hidden={open ? undefined : true}
      />
      <aside
        className={`care${open ? " open" : ""}`}
        aria-label="Pond Care"
        aria-hidden={open ? undefined : true}
      >
        <div className="care-head">
          <div className="top">
            <img src="/koi-mark.svg" alt="" style={{ width: 26, height: 26 }} />
            <h2>Pond Care</h2>
            <div
              className="x"
              role="button"
              tabIndex={0}
              aria-label="Close Pond Care"
              onClick={() => nav.setCareOpen(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  nav.setCareOpen(false);
                }
              }}
            >
              ✕
            </div>
          </div>
          <p>
            Tend the water DeKoi swims in. Changes settle instantly across
            every surface.
          </p>
        </div>

        <div className="care-tabs">
          {CARE_TABS.map((tab, i) => (
            <div
              key={tab.label}
              className={`ctab${nav.careTab === i ? " on" : ""}`}
              role="tab"
              tabIndex={0}
              aria-selected={nav.careTab === i}
              onClick={() => nav.setCareTab(i)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  nav.setCareTab(i);
                }
              }}
            >
              {tab.label} <small>{tab.hint}</small>
            </div>
          ))}
        </div>

        <div className="care-body">
          {nav.careTab === 0 ? (
            <>
              <p className="care-intro">
                Water settings shape how the whole pond behaves — language,
                flow, and the small currents of everyday use.
              </p>

              <div className="field">
                <label htmlFor="care-language">Language of the water</label>
                <select className="pondsel" id="care-language">
                  <option>English</option>
                </select>
                <div className="help">
                  English is the only current bundled for now. New languages
                  will surface here as they're stocked — without disturbing your
                  layout.
                </div>
              </div>

              <div className="toggle-row">
                <div className="tl">
                  <b>Let replies ripple in</b>
                  <i>stream responses word by word</i>
                </div>
                <Switch
                  checked={streamReplies}
                  onChange={setStreamReplies}
                  ariaLabel="Let replies ripple in"
                />
              </div>
              <div className="toggle-row">
                <div className="tl">
                  <b>Spotify mini player</b>
                  <i>a little music by the pond</i>
                </div>
                <Switch
                  checked={spotifyPlayer}
                  onChange={setSpotifyPlayer}
                  ariaLabel="Spotify mini player"
                />
              </div>

              <div className="slider-field">
                <div className="sl-top">
                  <b>Ripple speed</b>
                  <span>{rippleSpeed}</span>
                </div>
                <Slider
                  value={rippleSpeed}
                  onChange={setRippleSpeed}
                  ariaLabel="Ripple speed"
                />
                <div className="track-ends">
                  <span>Still</span>
                  <span>Rushing</span>
                </div>
              </div>

              <div className="toggle-row">
                <div className="tl">
                  <b>Surface all text at once</b>
                  <i>skip the reveal, show it all</i>
                </div>
                <Switch
                  checked={surfaceAllText}
                  onChange={setSurfaceAllText}
                  ariaLabel="Surface all text at once"
                />
              </div>
              <div className="toggle-row">
                <div className="tl">
                  <b>Wheel + click to navigate</b>
                  <i>scroll through the depths</i>
                </div>
                <Switch
                  checked={wheelNavigate}
                  onChange={setWheelNavigate}
                  ariaLabel="Wheel + click to navigate"
                />
              </div>

              <div className="slider-field">
                <div className="sl-top">
                  <b>Narration drift</b>
                  <span>{narrationDrift}</span>
                </div>
                <Slider
                  value={narrationDrift}
                  onChange={setNarrationDrift}
                  ariaLabel="Narration drift"
                />
                <div className="track-ends">
                  <span>Still</span>
                  <span>Rushing</span>
                </div>
              </div>

              <div className="slider-field">
                <div className="sl-top">
                  <b>Auto-play pause between segments</b>
                  <span>{(autoplayPause / 10).toFixed(1)}s</span>
                </div>
                <Slider
                  value={autoplayPause}
                  onChange={setAutoplayPause}
                  ariaLabel="Auto-play pause between segments"
                />
                <div className="track-ends">
                  <span>Short</span>
                  <span>Long</span>
                </div>
              </div>

              <div className="field">
                <label>Send on Enter</label>
                <div
                  className="help"
                  style={{ marginTop: 0, marginBottom: 10 }}
                >
                  Choose which surface sends when you press Enter.
                </div>
                <Seg
                  options={SEND_ON_ENTER_SURFACES}
                  value={nav.appSettings.sendOnEnterSurface}
                  onChange={nav.setSendOnEnterSurface}
                  ariaLabel="Send on Enter surface"
                />
              </div>

              <div className="toggle-row" style={{ borderBottom: "none" }}>
                <div className="tl">
                  <b>Ask before releasing a koi</b>
                  <i>confirm before deleting</i>
                </div>
                <Switch
                  checked={nav.appSettings.confirmRelease}
                  onChange={nav.setConfirmRelease}
                  ariaLabel="Ask before releasing a koi"
                />
              </div>
            </>
          ) : nav.careTab === 4 ? (
            renderCatalogManager()
          ) : nav.careTab === 5 ? (
            renderStockingTools()
          ) : nav.careTab === 7 ? (
            <form className="runtime-panel" onSubmit={handleRuntimeSubmit}>
              <p className="care-intro">
                Deep Water controls where saved Messenger threads settle.
              </p>

              <div className="field">
                <label htmlFor="remote-runtime-url">Remote Runtime URL</label>
                <input
                  className="pondinput"
                  id="remote-runtime-url"
                  type="url"
                  placeholder="http://127.0.0.1:7341"
                  value={runtimeUrl}
                  onChange={(event) => setRuntimeUrl(event.target.value)}
                />
                <div className="help">Leave empty to use this browser only.</div>
              </div>

              <div className={`runtime-status ${nav.messengerStorageStatus}`}>
                <b>
                  {nav.messengerStorageMode === "remote"
                    ? "Remote runtime"
                    : "Local storage"}
                </b>
                <span>{runtimeStatusMessage}</span>
              </div>

              <div className="runtime-status">
                <b>
                  {desktopHostStatus?.hostKind === "tauri"
                    ? "Desktop host"
                    : "Browser host"}
                </b>
                <span>
                  {desktopHostStatus?.message ??
                    "Check whether native host capabilities are available."}
                </span>
              </div>

              {desktopHostStatus && (
                <div className="host-flags" aria-label="Desktop host readiness">
                  <span className={desktopHostStatus.storageReady ? "on" : ""}>
                    Storage
                  </span>
                  <span className={desktopHostStatus.secretsReady ? "on" : ""}>
                    Secrets
                  </span>
                  <span className={desktopHostStatus.runtimeReady ? "on" : ""}>
                    Runtime
                  </span>
                </div>
              )}

              <div className="runtime-actions">
                <button
                  type="button"
                  disabled={desktopStorageBusy}
                  onClick={handleDesktopStorageSave}
                >
                  Save host bundle
                </button>
                <button
                  type="button"
                  disabled={desktopStorageBusy}
                  onClick={handleDesktopStorageLoad}
                >
                  Load host bundle
                </button>
              </div>

              {desktopStorageStatus && (
                <p className="bundle-status">{desktopStorageStatus}</p>
              )}

              <div className="field">
                <label>Messenger connection</label>
                <div
                  className="help"
                  style={{ marginTop: 0, marginBottom: 10 }}
                >
                  New Messenger threads use this connection. Existing threads
                  keep the connection they were created with.
                </div>
                <Seg
                  options={messengerConnectionOptions}
                  value={nav.appSettings.activeMessengerConnectionId}
                  onChange={nav.setActiveMessengerConnectionId}
                  ariaLabel="Messenger connection"
                />
              </div>

              <div className="runtime-actions">
                <button type="submit">Apply</button>
                <button type="button" onClick={handleRuntimeTest}>
                  Test
                </button>
                <button type="button" onClick={handleUseLocalStorage}>
                  Use local
                </button>
                <button
                  type="button"
                  disabled={desktopHostBusy}
                  onClick={handleDesktopHostCheck}
                >
                  {desktopHostBusy ? "Checking host" : "Check host"}
                </button>
              </div>
            </form>
          ) : (
            <p style={{ color: "var(--mist)", fontSize: 13, marginTop: 20 }}>
              {CARE_TABS[nav.careTab].label} settings — coming soon.
            </p>
          )}
        </div>
      </aside>
    </>
  );
}
