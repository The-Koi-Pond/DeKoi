import { useEffect, useState } from "react";
import type {
  NavCatalogState,
  NavProviderConnectionActions,
  NavViewActions,
  NavViewState,
} from "../../navigation";
import type {
  ProviderConnectionProvider,
  ProviderConnectionRecord,
} from "../../../engine/contracts/types/provider-connection";
import {
  getProviderConnectionProviderOption,
  PROVIDER_CONNECTION_PROVIDER_OPTIONS,
  sanitizeProviderConnectionRecord,
} from "../../../engine/contracts/types/provider-connection";
import type { ProviderConnectionInput } from "../../../engine/catalog/provider-connection-actions";
import { checkProviderConnection } from "../../../shared/api/provider-connection-check";
import { fetchProviderConnectionModels } from "../../../shared/api/provider-connection-models";
import { isDesktopHostAvailable } from "../../../shared/api/desktop-host-common";
import { getDesktopProviderSecretStatus } from "../../../shared/api/desktop-provider-secrets";
import { isDesktopRuntimeUrl, readRemoteRuntimeUrl } from "../../../shared/api/runtime-target";
import { CatalogSurfaceBanner } from "../shared/CatalogSurfaceBanner";
import "../shared/CatalogSurface.css";

interface ConnectionsSurfaceProps {
  nav: ConnectionsSurfaceNav;
}

export type ConnectionsSurfaceNav = Pick<NavCatalogState, "providerConnections"> &
  Pick<
    NavProviderConnectionActions,
    "createProviderConnection" | "deleteProviderConnection" | "updateProviderConnection"
  > &
  Pick<NavViewActions, "setView"> &
  Pick<NavViewState, "view">;

interface DraftState {
  label: string;
  provider: ProviderConnectionProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
  keeperDefault: boolean;
}

const EMPTY_DRAFT: DraftState = {
  label: "",
  provider: "openai",
  apiKey: "",
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-4o-mini",
  keeperDefault: false,
};

function draftFromConnection(record: ProviderConnectionRecord): DraftState {
  return {
    label: record.label,
    provider: record.provider,
    apiKey: "",
    baseUrl: record.baseUrl,
    model: record.model,
    keeperDefault: record.keeperDefault,
  };
}

function draftToInput(draft: DraftState): ProviderConnectionInput {
  return {
    label: draft.label.trim(),
    provider: draft.provider,
    apiKey: draft.apiKey.trim(),
    baseUrl: draft.baseUrl.trim(),
    model: draft.model.trim(),
    summary: "",
    modelLabel: draft.model.trim() || null,
    keeperDefault: draft.keeperDefault,
  };
}

function normalizeDraft(draft: DraftState) {
  return {
    label: draft.label.trim(),
    provider: draft.provider,
    apiKey: draft.apiKey.trim(),
    baseUrl: draft.baseUrl.trim(),
    model: draft.model.trim(),
    keeperDefault: draft.keeperDefault,
  };
}

function draftsMatch(left: DraftState, right: DraftState) {
  const leftDraft = normalizeDraft(left);
  const rightDraft = normalizeDraft(right);

  return (
    leftDraft.label === rightDraft.label &&
    leftDraft.provider === rightDraft.provider &&
    leftDraft.apiKey === rightDraft.apiKey &&
    leftDraft.baseUrl === rightDraft.baseUrl &&
    leftDraft.model === rightDraft.model &&
    leftDraft.keeperDefault === rightDraft.keeperDefault
  );
}

interface ConnectionEditorProps {
  editingId: string | null;
  activeConnection: ProviderConnectionRecord | null;
  initialDraft: DraftState;
  onBack: () => void;
  onDelete?: () => Promise<void>;
  onSave: (input: ProviderConnectionInput) => Promise<void>;
}

type StoredSecretStatus = "idle" | "checking" | "available" | "missing" | "error";
type StoredSecretProbeStatus = "available" | "missing" | "error";

function ConnectionIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    >
      <path d="M10.2 13.8a4.2 4.2 0 0 0 5.9 0l2-2a4.2 4.2 0 0 0-5.9-5.9l-1.1 1.1" />
      <path d="M13.8 10.2a4.2 4.2 0 0 0-5.9 0l-2 2a4.2 4.2 0 0 0 5.9 5.9l1.1-1.1" />
    </svg>
  );
}

function ConnectionsBanner({
  actionsLocked = false,
  onBack,
  onDelete,
  onSave,
  saveLabel,
  saveState,
}: {
  actionsLocked?: boolean;
  onBack: () => void;
  onDelete?: () => void;
  onSave?: () => void;
  saveLabel?: string;
  saveState?: "clean" | "pending";
}) {
  return (
    <CatalogSurfaceBanner
      icon={<ConnectionIcon />}
      backDisabled={actionsLocked}
      deleteDisabled={actionsLocked}
      onBack={onBack}
      onDelete={onDelete}
      onSave={onSave}
      saveDisabled={actionsLocked}
      saveLabel={saveLabel}
      saveState={saveState}
      title="Connections"
    />
  );
}
function ConnectionEditor({
  editingId,
  activeConnection,
  initialDraft,
  onBack,
  onDelete,
  onSave,
}: ConnectionEditorProps) {
  const [draft, setDraft] = useState<DraftState>(initialDraft);
  const [fetchedModels, setFetchedModels] = useState<string[]>([]);
  const [modelFetchBusy, setModelFetchBusy] = useState(false);
  const [modelFetchStatus, setModelFetchStatus] = useState("");
  const [connectionCheckBusy, setConnectionCheckBusy] = useState(false);
  const [connectionCheckStatus, setConnectionCheckStatus] = useState("");
  const [saveStatus, setSaveStatus] = useState("");
  const [saveBusy, setSaveBusy] = useState(false);
  const [storedSecretProbe, setStoredSecretProbe] = useState<{
    scopeKey: string;
    status: StoredSecretProbeStatus;
  }>({ scopeKey: "", status: "missing" });
  const selectedProvider = getProviderConnectionProviderOption(draft.provider);
  const modelOptions = [...new Set([...fetchedModels, ...selectedProvider.models])];
  const hasPendingChanges = !draftsMatch(draft, initialDraft);
  const normalizedDraft = normalizeDraft(draft);
  const normalizedInitialDraft = normalizeDraft(initialDraft);
  const hasTypedKey = Boolean(normalizedDraft.apiKey);
  const remoteRuntimeUrl = readRemoteRuntimeUrl();
  const canUseDesktopRuntime =
    isDesktopRuntimeUrl(remoteRuntimeUrl) || (!remoteRuntimeUrl.trim() && isDesktopHostAvailable());
  const canCheckStoredDesktopSecret =
    Boolean(editingId) &&
    Boolean(activeConnection) &&
    canUseDesktopRuntime &&
    activeConnection?.status === "ready" &&
    normalizedDraft.provider === normalizedInitialDraft.provider &&
    normalizedDraft.baseUrl.replace(/\/+$/, "") ===
      normalizedInitialDraft.baseUrl.replace(/\/+$/, "");
  const storedSecretScopeKey =
    canCheckStoredDesktopSecret && editingId
      ? `${editingId}\n${normalizedDraft.provider}\n${normalizedDraft.baseUrl.replace(/\/+$/, "")}`
      : "";
  const storedSecretStatus: StoredSecretStatus = !storedSecretScopeKey
    ? "idle"
    : storedSecretProbe.scopeKey === storedSecretScopeKey
      ? storedSecretProbe.status
      : "checking";
  const canUseStoredDesktopSecret = storedSecretStatus === "available";

  function missingSecretMessage(action: "checking" | "fetching models") {
    if (
      storedSecretStatus === "checking" ||
      (canCheckStoredDesktopSecret && storedSecretStatus === "idle")
    ) {
      return "Checking saved API key access. Try again in a moment.";
    }
    if (
      !editingId ||
      activeConnection?.status === "needs-key" ||
      storedSecretStatus === "idle" ||
      storedSecretStatus === "missing"
    ) {
      return `API key required before ${action}.`;
    }
    return "Saved API key could not be verified. Re-enter the key.";
  }

  useEffect(() => {
    let cancelled = false;
    if (!storedSecretScopeKey || !editingId) {
      return () => {
        cancelled = true;
      };
    }

    getDesktopProviderSecretStatus(editingId, {
      provider: normalizedDraft.provider,
      baseUrl: normalizedDraft.baseUrl,
    })
      .then((status) => {
        if (cancelled) return;
        setStoredSecretProbe({
          scopeKey: storedSecretScopeKey,
          status: status.hasSecret ? "available" : "missing",
        });
      })
      .catch(() => {
        if (cancelled) return;
        setStoredSecretProbe({ scopeKey: storedSecretScopeKey, status: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, [editingId, normalizedDraft.provider, normalizedDraft.baseUrl, storedSecretScopeKey]);

  async function handleSave() {
    const input = draftToInput(draft);
    if (!input.label) return;
    if (!input.baseUrl) {
      setSaveStatus("Base URL required.");
      return;
    }
    if (!input.model) {
      setSaveStatus("Model required.");
      return;
    }
    setSaveBusy(true);
    setSaveStatus("");

    try {
      await onSave(input);
      setDraft((currentDraft) => ({ ...currentDraft, apiKey: "" }));
      setSaveStatus(
        input.apiKey
          ? "Saved. API key is stored on this device and excluded from exports."
          : "Saved.",
      );
    } catch (error) {
      setSaveStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setSaveBusy(false);
    }
  }

  function handleProviderChange(provider: ProviderConnectionProvider) {
    const nextProvider = getProviderConnectionProviderOption(provider);
    const previousProvider = getProviderConnectionProviderOption(draft.provider);
    const shouldReplaceBaseUrl =
      !draft.baseUrl.trim() || draft.baseUrl === previousProvider.defaultBaseUrl;
    const shouldReplaceModel = !draft.model.trim() || draft.model === previousProvider.defaultModel;

    setDraft({
      ...draft,
      provider,
      baseUrl: shouldReplaceBaseUrl ? nextProvider.defaultBaseUrl : draft.baseUrl,
      model: shouldReplaceModel ? nextProvider.defaultModel : draft.model,
      apiKey: nextProvider.apiKeyRequired ? draft.apiKey : "",
    });
    setFetchedModels([]);
    setModelFetchStatus("");
    setConnectionCheckStatus("");
  }

  async function handleFetchModels() {
    const input = draftToInput(draft);
    if (!input.baseUrl) {
      setModelFetchStatus("Base URL required.");
      return;
    }
    if (selectedProvider.apiKeyRequired && !hasTypedKey && !canUseStoredDesktopSecret) {
      setModelFetchStatus(missingSecretMessage("fetching models"));
      return;
    }

    setModelFetchBusy(true);
    setModelFetchStatus("Fetching models...");

    try {
      const result = await fetchProviderConnectionModels(
        canUseStoredDesktopSecret && !hasTypedKey
          ? {
              ...input,
              id: editingId ?? undefined,
              status: activeConnection?.status,
            }
          : input,
      );
      const models = result.models;
      setFetchedModels(models);
      setModelFetchStatus(
        models.length > 0 ? `${models.length} models found.` : "No models found.",
      );

      if (!draft.model.trim() && models[0]) {
        setDraft((currentDraft) => ({
          ...currentDraft,
          model: models[0],
        }));
      }
    } catch (error) {
      setFetchedModels([]);
      setModelFetchStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setModelFetchBusy(false);
    }
  }

  async function handleCheckConnection() {
    const input = draftToInput(draft);
    if (!input.baseUrl) {
      setConnectionCheckStatus("Base URL required.");
      return;
    }
    if (!input.model) {
      setConnectionCheckStatus("Model required.");
      return;
    }
    if (selectedProvider.apiKeyRequired && !hasTypedKey && !canUseStoredDesktopSecret) {
      setConnectionCheckStatus(missingSecretMessage("checking"));
      return;
    }

    setConnectionCheckBusy(true);
    setConnectionCheckStatus("Checking API key...");
    try {
      const result = await checkProviderConnection(
        canUseStoredDesktopSecret && !hasTypedKey
          ? {
              ...input,
              id: editingId ?? undefined,
              status: activeConnection?.status,
            }
          : input,
      );
      setConnectionCheckStatus(result.message || "API key is valid.");
    } catch (error) {
      setConnectionCheckStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setConnectionCheckBusy(false);
    }
  }
  return (
    <>
      <ConnectionsBanner
        actionsLocked={saveBusy}
        onBack={onBack}
        onDelete={onDelete}
        onSave={handleSave}
        saveLabel={editingId ? "Save Changes" : "Create"}
        saveState={hasPendingChanges ? "pending" : "clean"}
      />
      <div className="pond-inner catalog-inner catalog-editor-only">
        <div className="catalog-editor">
          <div className="catalog-editor-field">
            <label htmlFor="conn-label">Connection Name</label>
            <input
              id="conn-label"
              className="pondinput"
              type="text"
              autoComplete="off"
              value={draft.label}
              onChange={(event) => setDraft({ ...draft, label: event.target.value })}
              placeholder="e.g. OpenAI Main"
            />
          </div>
          <div className="catalog-editor-grid">
            <div className="catalog-editor-field">
              <label htmlFor="conn-provider">Provider</label>
              <select
                id="conn-provider"
                className="pondsel"
                value={draft.provider}
                onChange={(event) =>
                  handleProviderChange(event.target.value as ProviderConnectionProvider)
                }
              >
                {PROVIDER_CONNECTION_PROVIDER_OPTIONS.map((provider) => (
                  <option value={provider.value} key={provider.value}>
                    {provider.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="catalog-editor-field">
              <label htmlFor="conn-model">Model</label>
              <div className="catalog-model-control">
                <input
                  id="conn-model"
                  className="pondinput"
                  type="text"
                  list="conn-model-options"
                  value={draft.model}
                  onChange={(event) => setDraft({ ...draft, model: event.target.value })}
                  placeholder={selectedProvider.defaultModel || "Model id from the provider"}
                />
                <button
                  type="button"
                  className="catalog-model-fetch"
                  disabled={modelFetchBusy || !draft.baseUrl.trim()}
                  onClick={handleFetchModels}
                  aria-label="Fetch models from Base URL"
                >
                  {modelFetchBusy ? "..." : "Fetch"}
                </button>
              </div>
              <datalist id="conn-model-options">
                {modelOptions.map((model) => (
                  <option value={model} key={model} />
                ))}
              </datalist>
              {modelFetchStatus && (
                <div className="catalog-model-status" role="status">
                  {modelFetchStatus}
                </div>
              )}
            </div>
          </div>
          <div className="catalog-editor-field">
            <label htmlFor="conn-api-key">API Key</label>
            <div className="catalog-model-control">
              <input
                id="conn-api-key"
                className="pondinput"
                type="password"
                autoComplete="off"
                value={draft.apiKey}
                onChange={(event) => {
                  setDraft({ ...draft, apiKey: event.target.value });
                  setConnectionCheckStatus("");
                }}
                placeholder={
                  selectedProvider.apiKeyRequired
                    ? "Enter a new key to store on this device"
                    : "Optional for this provider"
                }
              />
              <button
                type="button"
                className="catalog-model-fetch"
                disabled={connectionCheckBusy || !draft.baseUrl.trim() || !draft.model.trim()}
                onClick={handleCheckConnection}
                aria-label="Check API key with selected model"
              >
                {connectionCheckBusy ? "..." : "Check"}
              </button>
            </div>
            {connectionCheckStatus && (
              <div className="catalog-model-status" role="status">
                {connectionCheckStatus}
              </div>
            )}
            {saveStatus && (
              <div className="catalog-model-status" role="status">
                {saveStatus}
              </div>
            )}
          </div>
          <div className="catalog-editor-field">
            <label htmlFor="conn-base-url">Base URL</label>
            <input
              id="conn-base-url"
              className="pondinput"
              type="url"
              value={draft.baseUrl}
              onChange={(event) => {
                setDraft({ ...draft, baseUrl: event.target.value });
                setFetchedModels([]);
                setModelFetchStatus("");
                setConnectionCheckStatus("");
              }}
              placeholder={
                selectedProvider.defaultBaseUrl || "http://localhost:11434/v1 or provider endpoint"
              }
            />
          </div>
          <div className="catalog-editor-toggle">
            <span className="catalog-toggle-label">Keeper Default Connection</span>
            <input
              type="checkbox"
              checked={draft.keeperDefault}
              onChange={(event) => setDraft({ ...draft, keeperDefault: event.target.checked })}
              aria-label="Keeper Default Connection"
            />
          </div>
        </div>
      </div>
    </>
  );
}

export function ConnectionsSurface({ nav }: ConnectionsSurfaceProps) {
  const activeConnectionId = nav.view.kind === "connections" ? nav.view.connectionId : null;
  const activeConnectionRecord = activeConnectionId
    ? (nav.providerConnections.find((connection) => connection.id === activeConnectionId) ?? null)
    : null;
  const activeConnection = activeConnectionRecord
    ? sanitizeProviderConnectionRecord(activeConnectionRecord)
    : null;
  const isCreating = nav.view.kind === "connections" && nav.view.mode === "new";
  const editingId = activeConnection?.id ?? null;
  const showEditor = isCreating || activeConnection !== null;
  const initialDraft = activeConnection ? draftFromConnection(activeConnection) : EMPTY_DRAFT;

  async function handleSave(input: ProviderConnectionInput) {
    if (editingId) {
      await nav.updateProviderConnection(editingId, input);
      nav.setView({ kind: "connections", connectionId: editingId });
      return;
    }

    const connection = await nav.createProviderConnection(input);
    nav.setView({ kind: "connections", connectionId: connection.id });
  }

  function handleBack() {
    nav.setView({ kind: "pond" });
  }

  async function handleDelete() {
    if (!editingId) return;
    await nav.deleteProviderConnection(editingId);
    nav.setView({ kind: "connections" });
  }

  return (
    <main className="pond catalog-surface">
      {showEditor ? (
        <ConnectionEditor
          key={editingId ?? "new-connection"}
          editingId={editingId}
          activeConnection={activeConnection}
          initialDraft={initialDraft}
          onBack={handleBack}
          onDelete={editingId ? handleDelete : undefined}
          onSave={handleSave}
        />
      ) : (
        <>
          <ConnectionsBanner onBack={handleBack} />
          <div className="pond-inner catalog-inner catalog-editor-only">
            <div className="catalog-empty">
              Pick a connection from The Shoal or create a new one.
            </div>
          </div>
        </>
      )}
    </main>
  );
}
