import { useState } from "react";
import { useNav } from "../../shared/ui/nav-context";
import type { CharacterRecordInput } from "../../engine/character-actions";
import { DeleteButton } from "./DeleteButton";
import "./CatalogSurface.css";

interface DraftState {
  displayName: string;
  shortName: string;
  summary: string;
  description: string;
  avatarUrl: string;
}

const EMPTY_DRAFT: DraftState = {
  displayName: "",
  shortName: "",
  summary: "",
  description: "",
  avatarUrl: "",
};

function draftFromCharacter(record: {
  displayName: string;
  shortName: string | null;
  summary: string;
  description: string;
  avatarUrl: string | null;
}): DraftState {
  return {
    displayName: record.displayName,
    shortName: record.shortName ?? "",
    summary: record.summary,
    description: record.description,
    avatarUrl: record.avatarUrl ?? "",
  };
}

function draftToInput(draft: DraftState): CharacterRecordInput {
  return {
    displayName: draft.displayName.trim(),
    shortName: draft.shortName.trim() || null,
    summary: draft.summary.trim(),
    description: draft.description.trim(),
    avatarUrl: draft.avatarUrl.trim() || null,
  };
}

export function CompanionsSurface() {
  const nav = useNav();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [showEditor, setShowEditor] = useState(false);

  function openNew() {
    setDraft(EMPTY_DRAFT);
    setEditingId(null);
    setShowEditor(true);
  }

  function openEdit(characterId: string) {
    const record = nav.characters.find((c) => c.id === characterId);
    if (!record) return;
    setDraft(draftFromCharacter(record));
    setEditingId(characterId);
    setShowEditor(true);
  }

  function handleSave() {
    const input = draftToInput(draft);
    if (!input.displayName) return;

    if (editingId) {
      nav.updateCharacter(editingId, input);
    } else {
      nav.createCharacter(input);
    }
    setShowEditor(false);
    setDraft(EMPTY_DRAFT);
    setEditingId(null);
  }

  function handleDuplicate(characterId: string) {
    nav.duplicateCharacter(characterId);
  }

  function handleDelete(characterId: string) {
    nav.deleteCharacter(characterId);
    if (editingId === characterId) {
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
        <span className="ic" aria-hidden="true">
          ⚇
        </span>
        Companions
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
          <span className="catalog-count">
            {nav.characters.length} companions
          </span>
          <button type="button" className="catalog-new-btn" onClick={openNew}>
            + New Companion
          </button>
        </div>

        {nav.characters.length === 0 && !showEditor && (
          <p className="catalog-empty">
            No companions yet. Create one to stock your shoal.
          </p>
        )}

        <div className="catalog-list">
          {nav.characters.map((character) => (
            <article className="catalog-card" key={character.id}>
              <div className="catalog-card-body">
                <div className="catalog-avatar">
                  {character.displayName.charAt(0).toUpperCase()}
                </div>
                <div className="catalog-card-copy">
                  <b>{character.displayName}</b>
                  {character.shortName && (
                    <small>aka {character.shortName}</small>
                  )}
                  <span className="catalog-card-summary">
                    {character.summary}
                  </span>
                </div>
              </div>
              <div className="catalog-card-actions">
                <button
                  type="button"
                  className="catalog-action"
                  aria-label={`Edit ${character.displayName}`}
                  onClick={() => openEdit(character.id)}
                >
                  ✎
                </button>
                <button
                  type="button"
                  className="catalog-action"
                  aria-label={`Duplicate ${character.displayName}`}
                  onClick={() => handleDuplicate(character.id)}
                >
                  ⧉
                </button>
                <DeleteButton
                  ariaLabel={`Delete ${character.displayName}`}
                  onConfirm={() => handleDelete(character.id)}
                />
              </div>
            </article>
          ))}
        </div>

        {showEditor && (
          <div className="catalog-editor">
            <h3 className="catalog-editor-heading">
              {editingId ? "Edit Companion" : "New Companion"}
            </h3>
            <div className="catalog-editor-field">
              <label htmlFor="comp-name">Display Name</label>
              <input
                id="comp-name"
                className="pondinput"
                type="text"
                value={draft.displayName}
                onChange={(e) =>
                  setDraft({ ...draft, displayName: e.target.value })
                }
                placeholder="e.g. Hikari"
              />
            </div>
            <div className="catalog-editor-field">
              <label htmlFor="comp-short">Short Name</label>
              <input
                id="comp-short"
                className="pondinput"
                type="text"
                value={draft.shortName}
                onChange={(e) =>
                  setDraft({ ...draft, shortName: e.target.value })
                }
                placeholder="Optional nickname"
              />
            </div>
            <div className="catalog-editor-field">
              <label htmlFor="comp-summary">Summary</label>
              <input
                id="comp-summary"
                className="pondinput"
                type="text"
                value={draft.summary}
                onChange={(e) =>
                  setDraft({ ...draft, summary: e.target.value })
                }
                placeholder="Brief description"
              />
            </div>
            <div className="catalog-editor-field">
              <label htmlFor="comp-desc">Description</label>
              <textarea
                id="comp-desc"
                className="pondinput pondtextarea"
                rows={4}
                value={draft.description}
                onChange={(e) =>
                  setDraft({ ...draft, description: e.target.value })
                }
                placeholder="Full description…"
              />
            </div>
            <div className="catalog-editor-field">
              <label htmlFor="comp-avatar">Avatar URL</label>
              <input
                id="comp-avatar"
                className="pondinput"
                type="text"
                value={draft.avatarUrl}
                onChange={(e) =>
                  setDraft({ ...draft, avatarUrl: e.target.value })
                }
                placeholder="Optional URL"
              />
            </div>
            <div className="catalog-editor-actions">
              <button
                type="button"
                className="catalog-save-btn"
                onClick={handleSave}
              >
                {editingId ? "Save Changes" : "Create"}
              </button>
              <button
                type="button"
                className="catalog-cancel-btn"
                onClick={handleCancel}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
