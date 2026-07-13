import { useState, type ComponentProps } from "react";
import type { PromptPresetInput } from "../../../engine/prompt-presets/prompt-preset-actions";
import type {
  NavCatalogState,
  NavPromptPresetActions,
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
  Pick<NavViewActions, "setView"> &
  Pick<NavViewState, "view">;

interface PromptPresetEditorProps {
  editingId: string | null;
  initialDraft: PromptPresetDraftState;
  onBack: () => void;
  onDelete?: () => Promise<void>;
  onDuplicate?: () => void;
  onSave: (input: PromptPresetInput) => void;
  fileActions: Omit<
    ComponentProps<typeof PromptPresetFileActions>,
    "visibility" | "selectedPresetId" | "exportBlockedReason"
  >;
}

function PromptPresetEditor({
  editingId,
  initialDraft,
  onBack,
  onDelete,
  onDuplicate,
  onSave,
  fileActions,
}: PromptPresetEditorProps) {
  const [draft, setDraft] = useState<PromptPresetDraftState>(initialDraft);
  const hasPendingChanges = !promptPresetDraftsMatch(draft, initialDraft);
  const canSave = canSavePromptPresetDraft(draft);
  const systemPromptHint =
    draft.sections.length > 0
      ? "Roleplay sections are present, so Roleplay uses those sections instead of System Prompt. System Prompt remains the fallback when Roleplay has no sections."
      : "Roleplay uses System Prompt when no Roleplay sections are present. Messenger uses Messenger Prompt Source, or System Prompt when that source is empty.";

  function handleSave() {
    if (!canSave) return;
    onSave(promptPresetDraftToInput(draft));
  }

  return (
    <>
      <CatalogSurfaceBanner
        icon="≡"
        onBack={onBack}
        onDelete={onDelete}
        onSave={handleSave}
        saveDisabled={!canSave || !hasPendingChanges}
        saveLabel={editingId ? "Save Changes" : "Create"}
        saveState={hasPendingChanges ? "pending" : "clean"}
        subtitle={draft.summary || "Prompt preset"}
        title={draft.title || "New Preset"}
      />
      <div className="pond-inner catalog-inner catalog-editor-only">
        <div className="catalog-editor">
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
              <button type="button" className="catalog-new-btn" onClick={onDuplicate}>
                Duplicate Preset
              </button>
            </section>
          )}

          {editingId ? (
            <PromptPresetFileActions
              {...fileActions}
              visibility="editor"
              selectedPresetId={editingId}
              exportBlockedReason={
                hasPendingChanges ? "Save changes before exporting this preset." : undefined
              }
            />
          ) : (
            <PromptPresetFileActions {...fileActions} visibility="status" />
          )}
        </div>
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

  function handleSave(input: PromptPresetInput) {
    if (editingId) {
      nav.updatePromptPreset(editingId, input);
      nav.setView({ kind: "presets", presetId: editingId });
      return;
    }

    const preset = nav.createPromptPreset(input);
    nav.setView({ kind: "presets", presetId: preset.id });
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
          onBack={handleBack}
          onDelete={editingId ? handleDelete : undefined}
          onDuplicate={editingId ? handleDuplicate : undefined}
          onSave={handleSave}
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
