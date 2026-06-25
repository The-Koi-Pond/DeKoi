import { useState } from "react";
import { useNav } from "../../navigation/nav-context";
import type { PersonaRecordInput } from "../../../engine/persona-actions";
import { DeleteButton } from "../shared/DeleteButton";
import "../CatalogSurface.css";

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

export function PersonasSurface() {
  const nav = useNav();
  const activePersonaId =
    nav.view.kind === "personas" ? nav.view.personaId : null;
  const activePersona = activePersonaId
    ? nav.personas.find((persona) => persona.id === activePersonaId) ?? null
    : null;
  const isCreating = nav.view.kind === "personas" && nav.view.mode === "new";
  const editingId = activePersona?.id ?? null;
  const showEditor = isCreating || activePersona !== null;
  const initialDraft = activePersona ? draftFromPersona(activePersona) : EMPTY_DRAFT;

  function openNew() {
    nav.setView({ kind: "personas", mode: "new" });
  }

  function openEdit(personaId: string) {
    nav.setView({ kind: "personas", personaId });
  }

  function handleSave(input: PersonaRecordInput) {
    if (editingId) {
      nav.updatePersona(editingId, input);
    } else {
      nav.createPersona(input);
    }
    nav.setView({ kind: "personas" });
  }

  function handleDuplicate(personaId: string) {
    nav.duplicatePersona(personaId);
  }

  function handleDelete(personaId: string) {
    nav.deletePersona(personaId);
    if (editingId === personaId) {
      nav.setView({ kind: "personas" });
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
      <div className="pond-inner catalog-inner">
        <div className="catalog-toolbar">
          <span className="catalog-count">{nav.personas.length} personas</span>
          <button type="button" className="catalog-new-btn" onClick={openNew}>
            + New Persona
          </button>
        </div>

        {nav.personas.length === 0 && !showEditor && (
          <p className="catalog-empty">
            No personas yet. Create one to define how you appear in threads.
          </p>
        )}

        <div className="catalog-list">
          {nav.personas.map((persona) => (
            <article
              className={`catalog-card${
                editingId === persona.id ? " selected" : ""
              }`}
              key={persona.id}
            >
              <button
                type="button"
                className="catalog-card-body catalog-card-open"
                aria-label={`Edit ${persona.displayName}`}
                onClick={() => openEdit(persona.id)}
              >
                <div className="catalog-avatar">
                  {persona.displayName.charAt(0).toUpperCase()}
                </div>
                <div className="catalog-card-copy">
                  <b>{persona.displayName}</b>
                  <span className="catalog-card-summary">
                    {persona.summary}
                  </span>
                </div>
              </button>
              <div className="catalog-card-actions">
                <button
                  type="button"
                  className="catalog-action"
                  aria-label={`Edit ${persona.displayName}`}
                  onClick={() => openEdit(persona.id)}
                >
                  ✎
                </button>
                <button
                  type="button"
                  className="catalog-action"
                  aria-label={`Duplicate ${persona.displayName}`}
                  onClick={() => handleDuplicate(persona.id)}
                >
                  ⧉
                </button>
                <DeleteButton
                  ariaLabel={`Delete ${persona.displayName}`}
                  onConfirm={() => handleDelete(persona.id)}
                />
              </div>
            </article>
          ))}
        </div>

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
