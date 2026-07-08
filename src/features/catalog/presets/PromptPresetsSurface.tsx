import { useState } from "react";
import type { PromptPresetRecord } from "../../../engine/contracts/types/prompt-presets";
import type { PromptPresetInput } from "../../../engine/prompt-presets/prompt-preset-actions";
import type {
  NavCatalogState,
  NavPromptPresetActions,
  NavViewActions,
  NavViewState,
} from "../../navigation";
import { CatalogMacroTextarea } from "../shared/CatalogMacroTextarea";
import { CatalogSurfaceBanner } from "../shared/CatalogSurfaceBanner";
import "../shared/CatalogSurface.css";

interface PromptPresetsSurfaceProps {
  nav: PromptPresetsSurfaceNav;
}

export type PromptPresetsSurfaceNav = Pick<NavCatalogState, "promptPresets"> &
  Pick<
    NavPromptPresetActions,
    "createPromptPreset" | "deletePromptPreset" | "duplicatePromptPreset" | "updatePromptPreset"
  > &
  Pick<NavViewActions, "setView"> &
  Pick<NavViewState, "view">;

interface DraftState {
  title: string;
  summary: string;
  systemPrompt: string;
  messengerPrompt: string;
  maxTokens: string;
  temperature: string;
  topP: string;
}

const EMPTY_DRAFT: DraftState = {
  title: "",
  summary: "",
  systemPrompt: "",
  messengerPrompt: "",
  maxTokens: "",
  temperature: "",
  topP: "",
};

function optionalNumber(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function draftFromPreset(preset: PromptPresetRecord): DraftState {
  return {
    title: preset.title,
    summary: preset.summary ?? "",
    systemPrompt: preset.systemPrompt,
    messengerPrompt: preset.messengerPrompt ?? "",
    maxTokens: preset.sampling?.maxTokens?.toString() ?? "",
    temperature: preset.sampling?.temperature?.toString() ?? "",
    topP: preset.sampling?.topP?.toString() ?? "",
  };
}

function draftToInput(draft: DraftState): PromptPresetInput {
  return {
    title: draft.title.trim(),
    summary: draft.summary.trim() || null,
    systemPrompt: draft.systemPrompt.trim(),
    messengerPrompt: draft.messengerPrompt.trim() || null,
    sampling: {
      maxTokens: optionalNumber(draft.maxTokens),
      temperature: optionalNumber(draft.temperature),
      topP: optionalNumber(draft.topP),
    },
  };
}

function draftsMatch(left: DraftState, right: DraftState) {
  return JSON.stringify(draftToInput(left)) === JSON.stringify(draftToInput(right));
}

interface PromptPresetEditorProps {
  editingId: string | null;
  initialDraft: DraftState;
  onBack: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onSave: (input: PromptPresetInput) => void;
}

function PromptPresetEditor({
  editingId,
  initialDraft,
  onBack,
  onDelete,
  onDuplicate,
  onSave,
}: PromptPresetEditorProps) {
  const [draft, setDraft] = useState<DraftState>(initialDraft);
  const hasPendingChanges = !draftsMatch(draft, initialDraft);
  const canSave = draft.title.trim().length > 0 && draft.systemPrompt.trim().length > 0;

  function handleSave() {
    if (!canSave) return;
    onSave(draftToInput(draft));
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
                className="pondinput pondtextarea"
                rows={16}
                value={draft.systemPrompt}
                onValueChange={(systemPrompt) => setDraft({ ...draft, systemPrompt })}
                placeholder="System prompt used when this preset is selected."
              />
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
  const initialDraft = activePreset ? draftFromPreset(activePreset) : EMPTY_DRAFT;

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

  function handleDelete() {
    if (!editingId) return;
    nav.deletePromptPreset(editingId);
    nav.setView({ kind: "presets" });
  }

  function handleDuplicate() {
    if (!editingId) return;
    const preset = nav.duplicatePromptPreset(editingId);
    if (preset) nav.setView({ kind: "presets", presetId: preset.id });
  }

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
        />
      ) : (
        <>
          <CatalogSurfaceBanner icon="≡" onBack={handleBack} title="Presets" />
          <div className="pond-inner catalog-inner catalog-editor-only">
            <div className="catalog-empty">Pick a preset from The Shoal or create a new one.</div>
          </div>
        </>
      )}
    </main>
  );
}
