import { useState } from "react";
import type {
  NavCatalogState,
  NavProviderConnectionActions,
  NavViewActions,
  NavViewState,
} from "../../navigation";
import type {
  ProviderConnectionProvider,
  ProviderConnectionRecord,
} from "../../../engine/provider-connection";
import {
  getProviderConnectionProviderOption,
  PROVIDER_CONNECTION_PROVIDER_OPTIONS,
  sanitizeProviderConnectionRecord,
} from "../../../engine/provider-connection";
import type { ProviderConnectionInput } from "../../../engine/provider-connection-actions";
import "../shared/CatalogSurface.css";

interface ConnectionsSurfaceProps {
  nav: ConnectionsSurfaceNav;
}

export type ConnectionsSurfaceNav = Pick<
  NavCatalogState,
  "providerConnections"
> &
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
    apiKey: record.apiKey,
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

function buildModelsUrl(baseUrl: string) {
  const trimmed = baseUrl.trim();
  if (!trimmed) return "";

  const normalized = trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
  return normalized.endsWith("/models") ? normalized : `${normalized}/models`;
}

function getModelFetchHeaders(
  provider: ProviderConnectionProvider,
  apiKey: string,
) {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  const trimmedKey = apiKey.trim();
  if (!trimmedKey) return headers;

  if (provider === "anthropic") {
    headers["x-api-key"] = trimmedKey;
    headers["anthropic-version"] = "2023-06-01";
    return headers;
  }

  if (provider === "google") {
    headers["x-goog-api-key"] = trimmedKey;
    return headers;
  }

  headers.Authorization = `Bearer ${trimmedKey}`;
  return headers;
}

function readModelId(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";

  const record = value as Record<string, unknown>;
  const id = record.id ?? record.name ?? record.model ?? record.slug;
  return typeof id === "string" ? id.replace(/^models\//, "").trim() : "";
}

function parseModelList(payload: unknown) {
  const candidates = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object"
      ? ((payload as Record<string, unknown>).data ??
        (payload as Record<string, unknown>).models ??
        (payload as Record<string, unknown>).items)
      : null;

  if (!Array.isArray(candidates)) return [];

  return [
    ...new Set(
      candidates
        .map(readModelId)
        .filter((model) => model.length > 0)
        .sort((a, b) => a.localeCompare(b)),
    ),
  ];
}

interface ConnectionEditorProps {
  editingId: string | null;
  initialDraft: DraftState;
  onBack: () => void;
  onDelete?: () => void;
  onSave: (input: ProviderConnectionInput) => void;
}

interface ConnectionsBannerProps {
  onBack: () => void;
  onDelete?: () => void;
  onSave?: () => void;
  saveLabel?: string;
  saveState?: "clean" | "pending";
}

function ConnectionsBanner({
  onBack,
  onDelete,
  onSave,
  saveLabel = "Save Changes",
  saveState = "clean",
}: ConnectionsBannerProps) {
  return (
    <div className="pond-banner catalog-surface-banner">
      <button
        type="button"
        className="back-btn icon-only"
        onClick={onBack}
        aria-label="Back to Pond"
        title="Back to Pond"
      >
        ←
      </button>
      <span className="ic" aria-hidden="true">
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
      </span>
      <span>Connections</span>
      {onSave && (
        <div className="catalog-banner-actions">
          <button
            type="button"
            className={`catalog-save-btn catalog-save-btn-${saveState}`}
            onClick={onSave}
          >
            {saveLabel}
          </button>
          {onDelete && (
            <button
              type="button"
              className="catalog-cancel-btn danger"
              onClick={onDelete}
            >
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ConnectionEditor({
  editingId,
  initialDraft,
  onBack,
  onDelete,
  onSave,
}: ConnectionEditorProps) {
  const [draft, setDraft] = useState<DraftState>(initialDraft);
  const [fetchedModels, setFetchedModels] = useState<string[]>([]);
  const [modelFetchBusy, setModelFetchBusy] = useState(false);
  const [modelFetchStatus, setModelFetchStatus] = useState("");
  const selectedProvider = getProviderConnectionProviderOption(draft.provider);
  const modelOptions = [
    ...new Set([...fetchedModels, ...selectedProvider.models]),
  ];
  const hasPendingChanges = !draftsMatch(draft, initialDraft);

  function handleSave() {
    const input = draftToInput(draft);
    if (!input.label) return;
    onSave(input);
  }

  function handleProviderChange(provider: ProviderConnectionProvider) {
    const nextProvider = getProviderConnectionProviderOption(provider);
    const previousProvider = getProviderConnectionProviderOption(draft.provider);
    const shouldReplaceBaseUrl =
      !draft.baseUrl.trim() || draft.baseUrl === previousProvider.defaultBaseUrl;
    const shouldReplaceModel =
      !draft.model.trim() || draft.model === previousProvider.defaultModel;

    setDraft({
      ...draft,
      provider,
      baseUrl: shouldReplaceBaseUrl ? nextProvider.defaultBaseUrl : draft.baseUrl,
      model: shouldReplaceModel ? nextProvider.defaultModel : draft.model,
      apiKey: nextProvider.apiKeyRequired ? draft.apiKey : "",
    });
    setFetchedModels([]);
    setModelFetchStatus("");
  }

  async function handleFetchModels() {
    const modelsUrl = buildModelsUrl(draft.baseUrl);
    if (!modelsUrl) {
      setModelFetchStatus("Base URL required.");
      return;
    }

    setModelFetchBusy(true);
    setModelFetchStatus("Fetching models...");

    try {
      const response = await fetch(modelsUrl, {
        headers: getModelFetchHeaders(draft.provider, draft.apiKey),
      });

      if (!response.ok) {
        throw new Error(`Model fetch failed (${response.status}).`);
      }

      const models = parseModelList(await response.json());
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
      setModelFetchStatus(
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setModelFetchBusy(false);
    }
  }

  return (
    <>
      <ConnectionsBanner
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
              onChange={(event) =>
                setDraft({ ...draft, label: event.target.value })
              }
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
                  handleProviderChange(
                    event.target.value as ProviderConnectionProvider,
                  )
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
                  onChange={(event) =>
                    setDraft({ ...draft, model: event.target.value })
                  }
                  placeholder={
                    selectedProvider.defaultModel || "Model id from the provider"
                  }
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
            <input
              id="conn-api-key"
              className="pondinput"
              type="password"
              autoComplete="off"
              value={draft.apiKey}
              onChange={(event) =>
                setDraft({ ...draft, apiKey: event.target.value })
              }
              placeholder={
                selectedProvider.apiKeyRequired
                  ? "Required for this provider"
                  : "Optional for this provider"
              }
            />
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
              }}
              placeholder={
                selectedProvider.defaultBaseUrl ||
                "http://localhost:11434/v1 or provider endpoint"
              }
            />
          </div>
          <div className="catalog-editor-toggle">
            <span className="catalog-toggle-label">
              Keeper Default Connection
            </span>
            <input
              type="checkbox"
              checked={draft.keeperDefault}
              onChange={(event) =>
                setDraft({ ...draft, keeperDefault: event.target.checked })
              }
              aria-label="Keeper Default Connection"
            />
          </div>
        </div>
      </div>
    </>
  );
}

export function ConnectionsSurface({ nav }: ConnectionsSurfaceProps) {
  const activeConnectionId =
    nav.view.kind === "connections" ? nav.view.connectionId : null;
  const activeConnectionRecord = activeConnectionId
    ? nav.providerConnections.find(
        (connection) => connection.id === activeConnectionId,
      ) ?? null
    : null;
  const activeConnection = activeConnectionRecord
    ? sanitizeProviderConnectionRecord(activeConnectionRecord)
    : null;
  const isCreating = nav.view.kind === "connections" && nav.view.mode === "new";
  const editingId = activeConnection?.id ?? null;
  const showEditor = isCreating || activeConnection !== null;
  const initialDraft = activeConnection
    ? draftFromConnection(activeConnection)
    : EMPTY_DRAFT;

  function handleSave(input: ProviderConnectionInput) {
    if (editingId) {
      nav.updateProviderConnection(editingId, input);
      nav.setView({ kind: "connections", connectionId: editingId });
      return;
    }

    const connection = nav.createProviderConnection(input);
    nav.setView({ kind: "connections", connectionId: connection.id });
  }

  function handleBack() {
    nav.setView({ kind: "pond" });
  }

  function handleDelete() {
    if (!editingId) return;
    nav.deleteProviderConnection(editingId);
    nav.setView({ kind: "connections" });
  }

  return (
    <main className="pond catalog-surface">
      {showEditor ? (
        <ConnectionEditor
          key={editingId ?? "new-connection"}
          editingId={editingId}
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
