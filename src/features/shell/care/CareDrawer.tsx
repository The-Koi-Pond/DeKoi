import { useState, type ChangeEvent, type FormEvent } from "react";
import type { NavContextType } from "../../navigation";
import { Switch } from "../../../shared/ui/primitives/Switch";
import { Slider } from "../../../shared/ui/primitives/Slider";
import { NumberField } from "../../../shared/ui/primitives/NumberField";
import { Seg } from "../../../shared/ui/primitives/Seg";
import { Chip } from "../../../shared/ui/primitives/Chip";
import { SettingSection } from "./SettingSection";
import { CLASSIC, MESSENGER, RESERVED } from "../../../engine/surfaces";
import type {
  ProviderConnectionKind,
  ProviderConnectionRecord,
} from "../../../engine/provider-connection";
import {
  getDeKoiStorageBundleCounts,
  normalizeDeKoiStorageBundle,
  exportDesktopBundleFile,
  importDesktopBundleFile,
  readDesktopStorageBundle,
  writeDesktopStorageBundle,
  normalizeLegacyImport,
  type DeKoiStorageBundleCounts,
  type DeKoiStorageBundlePreview,
  type DeKoiLegacyImportPreview,
} from "../../runtime/storage-bundle-workflows";
import {
  checkDesktopHostStatus,
  type DeKoiDesktopHostStatus,
} from "../../../shared/api/desktop-host-status";
import {
  deleteDesktopProviderSecret,
  getDesktopProviderSecretStatus,
  writeDesktopProviderSecret,
  type DeKoiDesktopProviderSecretStatus,
} from "../../../shared/api/desktop-provider-secrets";
import { DESKTOP_RUNTIME_URL } from "../../../shared/api/runtime-target";
import { checkRemoteRuntimeHealth } from "../../../shared/api/remote-runtime";
import "./CareDrawer.css";
import "./care-fields.css";
import "../../../shared/ui/primitives/Chip.css";

interface CareDrawerProps {
  nav: NavContextType;
}

// Six settings-only tabs: all render real content or phase-appropriate placeholders.
const CARE_TABS = [
  { label: "General", hint: "basics" },
  { label: "Appearance", hint: "look" },
  { label: "Behavior", hint: "interaction" },
  { label: "Generation", hint: "defaults" },
  { label: "Connections", hint: "providers" },
  { label: "Data & Backup", hint: "storage" },
] as const;

// DeKoi-native surface ids for the Send-on-Enter segmented control.
const SEND_ON_ENTER_SURFACES = [
  { value: CLASSIC, label: "Classic" },
  { value: MESSENGER, label: "Messenger" },
  { value: RESERVED, label: "Reserved" },
] as const;

interface ProviderConnectionDraft {
  kind: ProviderConnectionKind;
  label: string;
  summary: string;
  modelLabel: string;
}

const EMPTY_CONNECTION_DRAFT: ProviderConnectionDraft = {
  kind: "mock",
  label: "",
  summary: "",
  modelLabel: "",
};

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
  const messengerConnectionOptions = nav.providerConnections.map(
    (connection) => ({
      value: connection.id,
      label: connection.label,
    }),
  );

  // Product settings live in nav.appSettings and persist across reloads.
  const {
    streamReplies,
    rippleSpeed,
    surfaceAllText,
    wheelNavigate,
    narrationDrift,
    autoplayPause,
    accent,
    motion,
    density,
    fontScale,
    defaultTemperature,
    defaultMaxTokens,
    defaultTopP,
  } = nav.appSettings;
  const [runtimeUrl, setRuntimeUrl] = useState(nav.remoteRuntimeUrl);
  const [runtimeHealth, setRuntimeHealth] = useState("");
  const [desktopHostStatus, setDesktopHostStatus] =
    useState<DeKoiDesktopHostStatus | null>(null);
  const [desktopHostBusy, setDesktopHostBusy] = useState(false);
  const [desktopStorageBusy, setDesktopStorageBusy] = useState(false);
  const [desktopStorageStatus, setDesktopStorageStatus] = useState("");
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
    rippleStates: nav.rippleStates,
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
    setRuntimeHealth(
      "Using desktop host storage when available; otherwise this browser session is temporary.",
    );
  }

  function handleUseDesktopRuntime() {
    const runtimeConnection = nav.providerConnections.find(
      (connection) => connection.kind === "remote-runtime",
    );
    setRuntimeUrl(DESKTOP_RUNTIME_URL);
    nav.setRemoteRuntimeUrl(DESKTOP_RUNTIME_URL);
    if (runtimeConnection) {
      nav.setActiveMessengerConnectionId(runtimeConnection.id);
    }
    setRuntimeHealth(
      runtimeConnection
        ? "Desktop runtime selected."
        : "Desktop runtime selected. Add a remote-runtime connection to use desktop generation.",
    );
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
        <span>
          <b>{counts.rippleStates}</b> Ripple states
        </span>
        <span>
          <b>{counts.ripples}</b> Ripples
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
              Supports previous thread export files. Converted records are added
              as native Messenger threads.
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

  function renderConnectionManager() {
    return (
      <section
        className="catalog-section"
        aria-labelledby="catalog-connections"
      >
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
                <button
                  type="button"
                  onClick={() => editConnection(connection)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => copyConnection(connection.id)}
                >
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
              onChange={(event) => setConnectionSecretInput(event.target.value)}
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
            Settings for the whole pond — language, look, behavior, generation
            defaults, providers, and your data.
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
                Language and regional preferences for the whole pond.
              </p>

              <div className="field">
                <label htmlFor="care-language">Language</label>
                <select className="pondsel" id="care-language">
                  <option>English</option>
                </select>
                <div className="help">
                  English is the only bundled language for now. New languages
                  will surface here as they're stocked — without disturbing your
                  layout.
                </div>
              </div>
            </>
          ) : nav.careTab === 1 ? (
            <>
              <p className="care-intro">
                Change how the pond looks. Changes apply instantly.
              </p>

              <SettingSection title="Accent">
                <Chip
                  options={[
                    { value: "koi", label: "Koi" },
                    { value: "jade", label: "Jade" },
                    { value: "amber", label: "Amber" },
                  ]}
                  value={accent}
                  onChange={(v) =>
                    nav.updateAppSettings({
                      accent: v as "koi" | "jade" | "amber",
                    })
                  }
                  ariaLabel="Accent color"
                />
              </SettingSection>

              <SettingSection title="Motion">
                <Seg
                  options={[
                    { value: "auto", label: "Auto" },
                    { value: "reduced", label: "Reduced" },
                    { value: "off", label: "Off" },
                  ]}
                  value={motion}
                  onChange={(v) =>
                    nav.updateAppSettings({
                      motion: v as "auto" | "reduced" | "off",
                    })
                  }
                  ariaLabel="Motion preference"
                />
                <div className="help" style={{ marginTop: 0 }}>
                  Auto follows your system&rsquo;s reduced-motion setting.
                </div>
              </SettingSection>

              <SettingSection title="Density">
                <Seg
                  options={[
                    { value: "comfortable", label: "Comfortable" },
                    { value: "compact", label: "Compact" },
                  ]}
                  value={density}
                  onChange={(v) =>
                    nav.updateAppSettings({
                      density: v as "comfortable" | "compact",
                    })
                  }
                  ariaLabel="Density preference"
                />
              </SettingSection>

              <SettingSection title="Text size">
                <Slider
                  value={fontScale}
                  onChange={(v) => nav.updateAppSettings({ fontScale: v })}
                  ariaLabel="Text size"
                  min={90}
                  max={120}
                  step={5}
                />
                <div className="track-ends">
                  <span>Small</span>
                  <span>Large</span>
                </div>
              </SettingSection>
            </>
          ) : nav.careTab === 2 ? (
            <>
              <p className="care-intro">How the pond responds to your touch.</p>

              <div className="toggle-row">
                <div className="tl">
                  <b>Let replies ripple in</b>
                  <i>stream responses word by word</i>
                </div>
                <Switch
                  checked={streamReplies}
                  onChange={(v) => nav.updateAppSettings({ streamReplies: v })}
                  ariaLabel="Let replies ripple in"
                />
              </div>

              <div className="slider-field">
                <div className="sl-top">
                  <b>Ripple speed</b>
                  <span>{rippleSpeed}</span>
                </div>
                <Slider
                  value={rippleSpeed}
                  onChange={(v) => nav.updateAppSettings({ rippleSpeed: v })}
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
                  onChange={(v) => nav.updateAppSettings({ surfaceAllText: v })}
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
                  onChange={(v) => nav.updateAppSettings({ wheelNavigate: v })}
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
                  onChange={(v) => nav.updateAppSettings({ narrationDrift: v })}
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
                  onChange={(v) => nav.updateAppSettings({ autoplayPause: v })}
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
          ) : nav.careTab === 3 ? (
            <>
              <p className="care-intro">
                Default generation parameters for new threads.
              </p>

              <SettingSection
                title="Generation"
                description="Global defaults for model output"
              >
                <div className="slider-field">
                  <div className="sl-top">
                    <b>Temperature</b>
                    <span>{(defaultTemperature / 100).toFixed(2)}</span>
                  </div>
                  <Slider
                    value={defaultTemperature}
                    onChange={(v) =>
                      nav.updateAppSettings({ defaultTemperature: v })
                    }
                    min={0}
                    max={200}
                    step={5}
                    ariaLabel="Temperature"
                  />
                  <div className="track-ends">
                    <span>Precise</span>
                    <span>Creative</span>
                  </div>
                </div>

                <div className="slider-field">
                  <div className="sl-top">
                    <b>Max tokens</b>
                    <span>{defaultMaxTokens}</span>
                  </div>
                  <NumberField
                    value={defaultMaxTokens}
                    onChange={(v) =>
                      nav.updateAppSettings({ defaultMaxTokens: v })
                    }
                    min={64}
                    max={8192}
                    step={64}
                    ariaLabel="Max tokens"
                  />
                </div>

                <div className="slider-field">
                  <div className="sl-top">
                    <b>Top-p</b>
                    <span>{(defaultTopP / 100).toFixed(2)}</span>
                  </div>
                  <Slider
                    value={defaultTopP}
                    onChange={(v) => nav.updateAppSettings({ defaultTopP: v })}
                    min={0}
                    max={100}
                    step={1}
                    ariaLabel="Top-p"
                  />
                  <div className="track-ends">
                    <span>Focused</span>
                    <span>Diverse</span>
                  </div>
                </div>
              </SettingSection>

              <p
                style={{
                  color: "var(--mist-dim)",
                  fontSize: 11,
                  lineHeight: 1.45,
                }}
              >
                These are global defaults. You can override them per thread in
                the messenger.
              </p>
            </>
          ) : nav.careTab === 4 ? (
            <>
              {renderConnectionManager()}
              <hr className="care-divider" />
              <form className="runtime-panel" onSubmit={handleRuntimeSubmit}>
                <p className="care-intro">Runtime host and storage mode.</p>

                <div className="field">
                  <label htmlFor="remote-runtime-url">Remote Runtime URL</label>
                  <input
                    className="pondinput"
                    id="remote-runtime-url"
                    type="url"
                    placeholder="http://127.0.0.1:7341 or desktop://runtime"
                    value={runtimeUrl}
                    onChange={(event) => setRuntimeUrl(event.target.value)}
                  />
                  <div className="help">
                    Leave empty for desktop host storage inside Tauri.
                    Browser-only sessions are temporary.
                  </div>
                </div>

                <div className={`runtime-status ${nav.messengerStorageStatus}`}>
                  <b>
                    {nav.messengerStorageMode === "remote"
                      ? "Remote runtime"
                      : nav.messengerStorageMode === "desktop"
                        ? "Desktop host"
                        : "Storage unavailable"}
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
                  <div
                    className="host-flags"
                    aria-label="Desktop host readiness"
                  >
                    <span
                      className={desktopHostStatus.storageReady ? "on" : ""}
                    >
                      Storage
                    </span>
                    <span
                      className={desktopHostStatus.secretsReady ? "on" : ""}
                    >
                      Secrets
                    </span>
                    <span
                      className={desktopHostStatus.runtimeReady ? "on" : ""}
                    >
                      Runtime
                    </span>
                  </div>
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
                    Use host default
                  </button>
                  <button type="button" onClick={handleUseDesktopRuntime}>
                    Use desktop
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
            </>
          ) : (
            <>
              <p className="care-intro">
                Export, import, and manage your DeKoi data.
              </p>
              {renderStockingTools()}

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
            </>
          )}
        </div>
      </aside>
    </>
  );
}
