import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
} from "react";
import type { PromptPresetInput } from "../../../engine/prompt-presets/prompt-preset-actions";
import type {
  NavCatalogState,
  NavPromptPresetActions,
  PromptPresetCatalogTransactionResult,
  NavViewActions,
  NavViewState,
} from "../../navigation";
import { CatalogMacroTextarea } from "../shared/CatalogMacroTextarea";
import { CatalogSurfaceBanner } from "../shared/CatalogSurfaceBanner";
import {
  canSavePromptPresetDraft,
  draftFromPromptPreset,
  EMPTY_PROMPT_PRESET_DRAFT,
  promptPresetDraftsMatch,
  promptPresetDraftToInput,
  type PromptPresetDraftState,
} from "./prompt-preset-draft";
import { PromptPresetChoiceEditor } from "./PromptPresetChoiceEditor";
import { PromptPresetFileActions } from "./PromptPresetFileActions";
import { PromptPresetStructureEditor } from "./PromptPresetStructureEditor";
import { deletePromptPresetAndNavigate } from "./prompt-presets-navigation";
import "../shared/CatalogSurface.css";
import "./PromptPresetsSurface.css";

interface PromptPresetsSurfaceProps {
  nav: PromptPresetsSurfaceNav;
}

export type PromptPresetsSurfaceNav = Pick<NavCatalogState, "promptPresets"> &
  Pick<
    NavPromptPresetActions,
    | "createPromptPreset"
    | "deletePromptPreset"
    | "duplicatePromptPreset"
    | "updatePromptPreset"
    | "importPromptPresetFile"
    | "openPromptPresetFile"
    | "exportPromptPresetFile"
    | "setPromptPresetFileStatus"
  > &
  Pick<NavCatalogState, "promptPresetFileHost" | "promptPresetFileStatus"> &
  Pick<NavViewActions, "setView" | "registerViewLeaveGuard"> &
  Pick<NavViewState, "view">;

interface PromptPresetEditorProps {
  editingId: string | null;
  initialDraft: PromptPresetDraftState;
  originalUpdatedAt: string | null;
  onBack: () => void;
  onDelete?: () => Promise<void>;
  onDuplicate?: () => void;
  onSave: (
    input: PromptPresetInput,
    expectedUpdatedAt: string | null,
  ) => Promise<PromptPresetCatalogTransactionResult>;
  onSaveSuccess: (result: PromptPresetCatalogTransactionResult) => void;
  registerViewLeaveGuard: NavViewActions["registerViewLeaveGuard"];
  fileActions: Omit<
    ComponentProps<typeof PromptPresetFileActions>,
    "visibility" | "selectedPresetId" | "exportBlockedReason"
  >;
}

function PromptPresetEditor({
  editingId,
  initialDraft,
  originalUpdatedAt,
  onBack,
  onDelete,
  onDuplicate,
  onSave,
  onSaveSuccess,
  registerViewLeaveGuard,
  fileActions,
}: PromptPresetEditorProps) {
  const [draft, setDraft] = useState<PromptPresetDraftState>(initialDraft);
  const [baseline, setBaseline] = useState(initialDraft);
  const [baselineVersion, setBaselineVersion] = useState(originalUpdatedAt);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const allowNextNavigationRef = useRef(false);
  const dirty = !promptPresetDraftsMatch(draft, baseline);
  const dirtyRef = useRef(dirty);
  const savingRef = useRef(saving);
  useLayoutEffect(() => {
    dirtyRef.current = dirty;
    savingRef.current = saving;
  }, [dirty, saving]);
  const canSave = canSavePromptPresetDraft(draft);
  const systemPromptHint =
    draft.sections.length > 0
      ? "Roleplay uses its sections first. System Prompt is next, followed by the built-in Roleplay prelude when neither has usable text."
      : "Roleplay uses System Prompt first, followed by the built-in Roleplay prelude when it has no usable text. Messenger uses Messenger Prompt Source first, then System Prompt, then its built-in prelude when neither has usable text.";

  const leavePolicy = useCallback(() => {
    if (allowNextNavigationRef.current) {
      allowNextNavigationRef.current = false;
      return "clean" as const;
    }
    if (savingRef.current) return "deny-silently" as const;
    return dirtyRef.current ? ("confirm-discard" as const) : ("clean" as const);
  }, []);
  const requestLeave = useCallback(() => {
    const policy = leavePolicy();
    if (policy === "deny-silently") return false;
    return policy !== "confirm-discard" || window.confirm("Discard unsaved changes?");
  }, [leavePolicy]);

  useEffect(() => {
    if (!dirty && !saving) return registerViewLeaveGuard(null);
    return registerViewLeaveGuard(leavePolicy);
  }, [dirty, leavePolicy, registerViewLeaveGuard, saving]);

  async function handleSave() {
    if (!canSave || !dirty || saving) return;
    setSaving(true);
    setError(null);
    let result: PromptPresetCatalogTransactionResult;
    try {
      result = await onSave(promptPresetDraftToInput(draft), baselineVersion);
    } catch (cause) {
      setSaving(false);
      setError(cause instanceof Error ? cause.message : String(cause));
      return;
    }
    setSaving(false);
    if (!result.published || !result.preset) {
      setError(result.message);
      return;
    }
    const next = draftFromPromptPreset(result.preset);
    setDraft(next);
    setBaseline(next);
    setBaselineVersion(result.preset.updatedAt);
    allowNextNavigationRef.current = true;
    onSaveSuccess(result);
  }

  return (
    <>
      <CatalogSurfaceBanner
        icon="≡"
        backDisabled={saving}
        onBack={onBack}
        onDelete={
          onDelete
            ? async () => {
                if (!requestLeave()) return;
                allowNextNavigationRef.current = true;
                try {
                  await onDelete();
                } finally {
                  allowNextNavigationRef.current = false;
                }
              }
            : undefined
        }
        deleteDisabled={saving}
        onSave={handleSave}
        saveDisabled={!canSave || !dirty || saving}
        saveLabel={editingId ? "Save Changes" : "Create"}
        saveState={dirty ? "pending" : "clean"}
        subtitle={draft.summary || "Prompt preset"}
        title={draft.title || "New Preset"}
      />
      {error && (
        <p role="alert" className="catalog-surface-error">
          {error}
        </p>
      )}
      <div className="pond-inner catalog-inner catalog-editor-only">
        <fieldset className="catalog-editor" disabled={saving} aria-busy={saving}>
          <section className="catalog-editor-section" aria-labelledby="preset-core-heading">
            <h4 id="preset-core-heading">Preset</h4>
            <div className="catalog-editor-grid">
              <div className="catalog-editor-field">
                <label htmlFor="preset-title">Title</label>
                <input
                  id="preset-title"
                  className="pondinput"
                  type="text"
                  value={draft.title}
                  onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                  placeholder="e.g. Cinematic Roleplay"
                />
              </div>
              <div className="catalog-editor-field">
                <label htmlFor="preset-summary">Summary</label>
                <input
                  id="preset-summary"
                  className="pondinput"
                  type="text"
                  value={draft.summary}
                  onChange={(event) => setDraft({ ...draft, summary: event.target.value })}
                  placeholder="Optional"
                />
              </div>
            </div>
            <div className="catalog-editor-field">
              <label htmlFor="preset-system-prompt">System Prompt</label>
              <CatalogMacroTextarea
                id="preset-system-prompt"
                aria-describedby="preset-system-prompt-hint"
                className="pondinput pondtextarea"
                rows={16}
                value={draft.systemPrompt}
                onValueChange={(systemPrompt) => setDraft({ ...draft, systemPrompt })}
                placeholder="System prompt used when this preset is selected."
              />
              <p className="catalog-field-hint" id="preset-system-prompt-hint">
                {systemPromptHint}
              </p>
            </div>
            <div className="catalog-editor-field">
              <label htmlFor="preset-messenger-prompt">Messenger Prompt Source</label>
              <CatalogMacroTextarea
                id="preset-messenger-prompt"
                className="pondinput pondtextarea"
                rows={12}
                value={draft.messengerPrompt}
                onValueChange={(messengerPrompt) => setDraft({ ...draft, messengerPrompt })}
                placeholder="Optional Messenger-specific prompt source. Empty uses System Prompt."
              />
            </div>
          </section>

          <PromptPresetStructureEditor draft={draft} onDraftChange={setDraft} />

          <PromptPresetChoiceEditor draft={draft} onDraftChange={setDraft} />

          <section className="catalog-editor-section" aria-labelledby="preset-sampling-heading">
            <h4 id="preset-sampling-heading">Sampling</h4>
            <div className="catalog-editor-grid compact">
              <div className="catalog-editor-field">
                <label htmlFor="preset-temperature">Temperature</label>
                <input
                  id="preset-temperature"
                  className="pondinput"
                  type="number"
                  min="0"
                  max="2"
                  step="0.05"
                  value={draft.temperature}
                  onChange={(event) => setDraft({ ...draft, temperature: event.target.value })}
                  placeholder="Provider default"
                />
              </div>
              <div className="catalog-editor-field">
                <label htmlFor="preset-top-p">Top P</label>
                <input
                  id="preset-top-p"
                  className="pondinput"
                  type="number"
                  min="0"
                  max="1"
                  step="0.05"
                  value={draft.topP}
                  onChange={(event) => setDraft({ ...draft, topP: event.target.value })}
                  placeholder="Provider default"
                />
              </div>
              <div className="catalog-editor-field">
                <label htmlFor="preset-max-tokens">Max Tokens</label>
                <input
                  id="preset-max-tokens"
                  className="pondinput"
                  type="number"
                  min="1"
                  step="1"
                  value={draft.maxTokens}
                  onChange={(event) => setDraft({ ...draft, maxTokens: event.target.value })}
                  placeholder="Provider default"
                />
              </div>
            </div>
          </section>

          {editingId && onDuplicate && (
            <section className="catalog-editor-section" aria-labelledby="preset-actions-heading">
              <h4 id="preset-actions-heading">Actions</h4>
              <button
                type="button"
                className="catalog-new-btn"
                onClick={() => {
                  if (!requestLeave()) return;
                  allowNextNavigationRef.current = true;
                  try {
                    onDuplicate();
                  } finally {
                    allowNextNavigationRef.current = false;
                  }
                }}
                disabled={saving}
              >
                Duplicate Preset
              </button>
            </section>
          )}

          {editingId ? (
            <PromptPresetFileActions
              {...fileActions}
              visibility="editor"
              selectedPresetId={editingId}
              exportBlockedReason={dirty ? "Save changes before exporting this preset." : undefined}
            />
          ) : (
            <PromptPresetFileActions {...fileActions} visibility="status" />
          )}
        </fieldset>
      </div>
    </>
  );
}

export function PromptPresetsSurface({ nav }: PromptPresetsSurfaceProps) {
  const activePresetId = nav.view.kind === "presets" ? nav.view.presetId : null;
  const activePreset = activePresetId
    ? (nav.promptPresets.find((preset) => preset.id === activePresetId) ?? null)
    : null;
  const isCreating = nav.view.kind === "presets" && nav.view.mode === "new";
  const editingId = activePreset?.id ?? null;
  const showEditor = isCreating || activePreset !== null;
  const initialDraft = activePreset
    ? draftFromPromptPreset(activePreset)
    : EMPTY_PROMPT_PRESET_DRAFT;

  async function handleSave(input: PromptPresetInput, expectedUpdatedAt: string | null) {
    if (editingId) {
      const result = await nav.updatePromptPreset(editingId, input, expectedUpdatedAt ?? "");
      return result;
    }
    const result = await nav.createPromptPreset(input);
    return result;
  }

  function handleBack() {
    nav.setView({ kind: "pond" });
  }

  async function handleDelete(): Promise<void> {
    if (!editingId) return;
    await deletePromptPresetAndNavigate({
      presetId: editingId,
      deletePromptPreset: nav.deletePromptPreset,
      setPromptPresetFileStatus: nav.setPromptPresetFileStatus,
      setView: nav.setView,
    });
  }

  function handleDuplicate() {
    if (!editingId) return;
    const preset = nav.duplicatePromptPreset(editingId);
    if (preset) nav.setView({ kind: "presets", presetId: preset.id });
  }

  const fileActions = {
    host: nav.promptPresetFileHost,
    importPromptPresetFile: nav.importPromptPresetFile,
    openPromptPresetFile: nav.openPromptPresetFile,
    exportPromptPresetFile: nav.exportPromptPresetFile,
    navigationContext: nav.view,
    originActive: true,
    status: nav.promptPresetFileStatus,
    onImportedPresetReady: (presetId: string) => nav.setView({ kind: "presets", presetId }),
    onStatusChange: nav.setPromptPresetFileStatus,
  };

  return (
    <main className="pond catalog-surface">
      {showEditor ? (
        <PromptPresetEditor
          key={editingId ?? "new-preset"}
          editingId={editingId}
          initialDraft={initialDraft}
          originalUpdatedAt={activePreset?.updatedAt ?? null}
          onBack={handleBack}
          onDelete={editingId ? handleDelete : undefined}
          onDuplicate={editingId ? handleDuplicate : undefined}
          onSave={handleSave}
          onSaveSuccess={(result) => {
            if (result.published && result.preset)
              nav.setView({ kind: "presets", presetId: result.preset.id });
          }}
          registerViewLeaveGuard={nav.registerViewLeaveGuard}
          fileActions={fileActions}
        />
      ) : (
        <>
          <CatalogSurfaceBanner icon="≡" onBack={handleBack} title="Presets" />
          <div className="pond-inner catalog-inner catalog-editor-only">
            <div className="catalog-empty">Pick a preset from The Shoal or create a new one.</div>
            <PromptPresetFileActions {...fileActions} visibility="list" />
          </div>
        </>
      )}
    </main>
  );
}
