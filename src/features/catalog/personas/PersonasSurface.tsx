import { useState } from "react";
import type {
  NavCatalogState,
  NavPersonaActions,
  NavViewActions,
  NavViewState,
} from "../../navigation";
import type { PersonaRecordInput } from "../../../engine/persona-actions";
import "../shared/CatalogSurface.css";

interface PersonasSurfaceProps {
  nav: PersonasSurfaceNav;
}

export type PersonasSurfaceNav = Pick<
  NavCatalogState,
  "personas"
> &
  Pick<NavPersonaActions, "createPersona" | "updatePersona"> &
  Pick<NavViewActions, "setView"> &
  Pick<NavViewState, "view">;

interface DraftState {
  displayName: string;
  summary: string;
  description: string;
  avatarUrl: string;
}

const EMPTY_DRAFT: DraftState = {
  displayName: "",
  summary: "",
  description: "",
  avatarUrl: "",
};

function draftFromPersona(record: {
  displayName: string;
  summary: string;
  description: string;
  avatarUrl: string | null;
}): DraftState {
  return {
    displayName: record.displayName,
    summary: record.summary,
    description: record.description,
    avatarUrl: record.avatarUrl ?? "",
  };
}

function draftToInput(draft: DraftState): PersonaRecordInput {
  return {
    displayName: draft.displayName.trim(),
    summary: draft.summary.trim(),
    description: draft.description.trim(),
    avatarUrl: draft.avatarUrl.trim() || null,
  };
}

interface PersonaEditorProps {
  editingId: string | null;
  initialDraft: DraftState;
  onCancel: () => void;
  onSave: (input: PersonaRecordInput) => void;
}

function PersonaEditor({
  editingId,
  initialDraft,
  onCancel,
  onSave,
}: PersonaEditorProps) {
  const [draft, setDraft] = useState<DraftState>(initialDraft);

  function handleSave() {
    const input = draftToInput(draft);
    if (!input.displayName) return;
    onSave(input);
  }

  return (
    <div className="catalog-editor">
      <h3 className="catalog-editor-heading">
        {editingId ? "Edit Persona" : "New Persona"}
      </h3>
      <div className="catalog-editor-field">
        <label htmlFor="pers-name">Display Name</label>
        <input
          id="pers-name"
          className="pondinput"
          type="text"
          value={draft.displayName}
          onChange={(e) =>
            setDraft({ ...draft, displayName: e.target.value })
          }
          placeholder="e.g. Ripples"
        />
      </div>
      <div className="catalog-editor-field">
        <label htmlFor="pers-summary">Summary</label>
        <input
          id="pers-summary"
          className="pondinput"
          type="text"
          value={draft.summary}
          onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
          placeholder="Brief description"
        />
      </div>
      <div className="catalog-editor-field">
        <label htmlFor="pers-desc">Description</label>
        <textarea
          id="pers-desc"
          className="pondinput pondtextarea"
          rows={4}
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          placeholder="Full description…"
        />
      </div>
      <div className="catalog-editor-field">
        <label htmlFor="pers-avatar">Avatar URL</label>
        <input
          id="pers-avatar"
          className="pondinput"
          type="text"
          value={draft.avatarUrl}
          onChange={(e) => setDraft({ ...draft, avatarUrl: e.target.value })}
          placeholder="Optional URL"
        />
      </div>
      <div className="catalog-editor-actions">
        <button type="button" className="catalog-save-btn" onClick={handleSave}>
          {editingId ? "Save Changes" : "Create"}
        </button>
        <button type="button" className="catalog-cancel-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export function PersonasSurface({ nav }: PersonasSurfaceProps) {
  const activePersonaId =
    nav.view.kind === "personas" ? nav.view.personaId : null;
  const activePersona = activePersonaId
    ? nav.personas.find((persona) => persona.id === activePersonaId) ?? null
    : null;
  const isCreating = nav.view.kind === "personas" && nav.view.mode === "new";
  const editingId = activePersona?.id ?? null;
  const showEditor = isCreating || activePersona !== null;
  const initialDraft = activePersona ? draftFromPersona(activePersona) : EMPTY_DRAFT;

  function handleSave(input: PersonaRecordInput) {
    if (editingId) {
      nav.updatePersona(editingId, input);
      nav.setView({ kind: "personas", personaId: editingId });
      return;
    } else {
      const persona = nav.createPersona(input);
      nav.setView({ kind: "personas", personaId: persona.id });
    }
  }

  function handleCancel() {
    nav.setView({ kind: "personas" });
  }

  return (
    <main className="pond catalog-surface">
      <div className="pond-banner">
        <span className="ic" aria-hidden="true">
          ◎
        </span>
        Personas
        <button
          type="button"
          className="back-btn"
          onClick={() => nav.setView({ kind: "pond" })}
        >
          ← Back to Pond
        </button>
      </div>
      <div className="pond-inner catalog-inner catalog-editor-only">
        {showEditor && (
          <PersonaEditor
            key={editingId ?? "new-persona"}
            editingId={editingId}
            initialDraft={initialDraft}
            onCancel={handleCancel}
            onSave={handleSave}
          />
        )}
      </div>
    </main>
  );
}
