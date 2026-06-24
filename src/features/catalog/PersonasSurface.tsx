import { useState } from "react";
import { useNav } from "../../shared/ui/nav-context";
import type { PersonaRecordInput } from "../../engine/persona-actions";
import "./CatalogSurface.css";

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

export function PersonasSurface() {
  const nav = useNav();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [showEditor, setShowEditor] = useState(false);

  function openNew() {
    setDraft(EMPTY_DRAFT);
    setEditingId(null);
    setShowEditor(true);
  }

  function openEdit(personaId: string) {
    const record = nav.personas.find((p) => p.id === personaId);
    if (!record) return;
    setDraft(draftFromPersona(record));
    setEditingId(personaId);
    setShowEditor(true);
  }

  function handleSave() {
    const input = draftToInput(draft);
    if (!input.displayName) return;

    if (editingId) {
      nav.updatePersona(editingId, input);
    } else {
      nav.createPersona(input);
    }
    setShowEditor(false);
    setDraft(EMPTY_DRAFT);
    setEditingId(null);
  }

  function handleDuplicate(personaId: string) {
    nav.duplicatePersona(personaId);
  }

  function handleDelete(personaId: string) {
    nav.deletePersona(personaId);
    if (editingId === personaId) {
      setShowEditor(false);
      setDraft(EMPTY_DRAFT);
      setEditingId(null);
    }
  }

  function handleCancel() {
    setShowEditor(false);
    setDraft(EMPTY_DRAFT);
    setEditingId(null);
  }

  return (
    <main className="pond catalog-surface">
      <div className="pond-banner">
        <span className="ic" aria-hidden="true">◎</span>
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
            <article className="catalog-card" key={persona.id}>
              <div className="catalog-card-body">
                <div className="catalog-avatar">
                  {persona.displayName.charAt(0).toUpperCase()}
                </div>
                <div className="catalog-card-copy">
                  <b>{persona.displayName}</b>
                  <span className="catalog-card-summary">{persona.summary}</span>
                </div>
              </div>
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
                <button
                  type="button"
                  className="catalog-action danger"
                  aria-label={`Delete ${persona.displayName}`}
                  onClick={() => handleDelete(persona.id)}
                >
                  ✕
                </button>
              </div>
            </article>
          ))}
        </div>

        {showEditor && (
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
                onChange={(e) => setDraft({ ...draft, displayName: e.target.value })}
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
              <button type="button" className="catalog-cancel-btn" onClick={handleCancel}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
