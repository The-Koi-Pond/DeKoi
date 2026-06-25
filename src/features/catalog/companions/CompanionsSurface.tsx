import { useState } from "react";
import type {
  NavCatalogState,
  NavCharacterActions,
  NavSettingsState,
  NavViewActions,
  NavViewState,
} from "../../navigation";
import type { CharacterRecordInput } from "../../../engine/character-actions";
import { DeleteButton } from "../shared/DeleteButton";
import "../shared/CatalogSurface.css";

interface CompanionsSurfaceProps {
  nav: CompanionsSurfaceNav;
}

export type CompanionsSurfaceNav = Pick<
  NavCatalogState,
  "characters"
> &
  Pick<NavCharacterActions, "createCharacter" | "deleteCharacter" | "duplicateCharacter" | "updateCharacter"> &
  Pick<NavSettingsState, "appSettings"> &
  Pick<NavViewActions, "setView"> &
  Pick<NavViewState, "view">;

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

interface CompanionEditorProps {
  editingId: string | null;
  initialDraft: DraftState;
  onCancel: () => void;
  onSave: (input: CharacterRecordInput) => void;
}

function CompanionEditor({
  editingId,
  initialDraft,
  onCancel,
  onSave,
}: CompanionEditorProps) {
  const [draft, setDraft] = useState<DraftState>(initialDraft);

  function handleSave() {
    const input = draftToInput(draft);
    if (!input.displayName) return;
    onSave(input);
  }

  return (
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
          onChange={(e) => setDraft({ ...draft, shortName: e.target.value })}
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
          onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
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
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
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

export function CompanionsSurface({ nav }: CompanionsSurfaceProps) {
  const activeCharacterId =
    nav.view.kind === "companions" ? nav.view.characterId : null;
  const activeCharacter = activeCharacterId
    ? nav.characters.find((character) => character.id === activeCharacterId) ??
      null
    : null;
  const isCreating =
    nav.view.kind === "companions" && nav.view.mode === "new";
  const editingId = activeCharacter?.id ?? null;
  const showEditor = isCreating || activeCharacter !== null;
  const initialDraft = activeCharacter
    ? draftFromCharacter(activeCharacter)
    : EMPTY_DRAFT;

  function openNew() {
    nav.setView({ kind: "companions", mode: "new" });
  }

  function openEdit(characterId: string) {
    nav.setView({ kind: "companions", characterId });
  }

  function handleSave(input: CharacterRecordInput) {
    if (editingId) {
      nav.updateCharacter(editingId, input);
    } else {
      nav.createCharacter(input);
    }
    nav.setView({ kind: "companions" });
  }

  function handleDuplicate(characterId: string) {
    nav.duplicateCharacter(characterId);
  }

  function handleDelete(characterId: string) {
    nav.deleteCharacter(characterId);
    if (editingId === characterId) {
      nav.setView({ kind: "companions" });
    }
  }

  function handleCancel() {
    nav.setView({ kind: "companions" });
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
            <article
              className={`catalog-card${
                editingId === character.id ? " selected" : ""
              }`}
              key={character.id}
            >
              <button
                type="button"
                className="catalog-card-body catalog-card-open"
                aria-label={`Edit ${character.displayName}`}
                onClick={() => openEdit(character.id)}
              >
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
              </button>
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
                  confirmRelease={nav.appSettings.confirmRelease}
                  onConfirm={() => handleDelete(character.id)}
                />
              </div>
            </article>
          ))}
        </div>

        {showEditor && (
          <CompanionEditor
            key={editingId ?? "new-companion"}
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
