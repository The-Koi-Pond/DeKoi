import { useState } from "react";
import { useNav } from "../navigation/nav-context";
import type {
  LorebookEntryInput,
  LorebookInput,
} from "../../engine/lorebook-actions";
import { Switch } from "../../shared/ui/primitives/Switch";
import { DeleteButton } from "./DeleteButton";
import "./CatalogSurface.css";

interface DraftState {
  title: string;
  body: string;
  enabled: boolean;
}

interface LorebookDraftState {
  title: string;
  summary: string;
}

const EMPTY_DRAFT: DraftState = { title: "", body: "", enabled: true };
const EMPTY_LOREBOOK_DRAFT: LorebookDraftState = { title: "", summary: "" };

function draftFromEntry(entry: {
  title: string;
  body: string;
  enabled: boolean;
}): DraftState {
  return { title: entry.title, body: entry.body, enabled: entry.enabled };
}

function draftToInput(draft: DraftState): LorebookEntryInput {
  return {
    title: draft.title.trim() || "Untitled note",
    body: draft.body.trim(),
    enabled: draft.enabled,
  };
}

export function LorebooksSurface() {
  const nav = useNav();
  const routedLorebookId =
    nav.view.kind === "lorebooks" ? nav.view.lorebookId : null;
  const initialLorebookId =
    routedLorebookId &&
    nav.lorebooks.some((lorebook) => lorebook.id === routedLorebookId)
      ? routedLorebookId
      : nav.lorebooks[0]?.id ?? null;
  const [selectedLorebookId, setSelectedLorebookId] = useState<string | null>(
    initialLorebookId,
  );
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [showEditor, setShowEditor] = useState(false);
  const [showLorebookEditor, setShowLorebookEditor] = useState(
    nav.view.kind === "lorebooks" && nav.view.mode === "new-lorebook",
  );
  const [lorebookDraft, setLorebookDraft] =
    useState<LorebookDraftState>(EMPTY_LOREBOOK_DRAFT);

  const activeLorebook = nav.lorebooks.find(
    (lb) => lb.id === selectedLorebookId,
  );

  function openNew() {
    setDraft(EMPTY_DRAFT);
    setEditingEntryId(null);
    setShowEditor(true);
  }

  function openEdit(entryId: string) {
    const entry = activeLorebook?.entries.find((e) => e.id === entryId);
    if (!entry) return;
    setDraft(draftFromEntry(entry));
    setEditingEntryId(entryId);
    setShowEditor(true);
  }

  function handleSave() {
    if (!selectedLorebookId) return;
    const input = draftToInput(draft);
    if (!input.title.trim()) return;

    if (editingEntryId) {
      nav.updateLorebookEntry(selectedLorebookId, editingEntryId, input);
    } else {
      nav.createLorebookEntry(selectedLorebookId, input);
    }
    setShowEditor(false);
    setDraft(EMPTY_DRAFT);
    setEditingEntryId(null);
  }

  function handleDuplicate(entryId: string) {
    if (!selectedLorebookId) return;
    nav.duplicateLorebookEntry(selectedLorebookId, entryId);
  }

  function handleDelete(entryId: string) {
    if (!selectedLorebookId) return;
    nav.deleteLorebookEntry(selectedLorebookId, entryId);
    if (editingEntryId === entryId) {
      setShowEditor(false);
      setDraft(EMPTY_DRAFT);
      setEditingEntryId(null);
    }
  }

  function handleCancel() {
    setShowEditor(false);
    setDraft(EMPTY_DRAFT);
    setEditingEntryId(null);
  }

  function openNewLorebook() {
    setLorebookDraft(EMPTY_LOREBOOK_DRAFT);
    setShowLorebookEditor(true);
  }

  function handleLorebookSave() {
    const input: LorebookInput = {
      title: lorebookDraft.title.trim(),
      summary: lorebookDraft.summary.trim(),
    };
    if (!input.title) return;
    const lorebook = nav.createLorebook(input);
    setSelectedLorebookId(lorebook.id);
    setShowLorebookEditor(false);
    setLorebookDraft(EMPTY_LOREBOOK_DRAFT);
  }

  function handleLorebookCancel() {
    setShowLorebookEditor(false);
    setLorebookDraft(EMPTY_LOREBOOK_DRAFT);
  }

  function handleDeleteLorebook(lorebookId: string) {
    nav.deleteLorebook(lorebookId);
    if (selectedLorebookId === lorebookId) {
      setSelectedLorebookId(null);
    }
  }

  function renderLorebookEditor({
    heading,
    onSave,
    onCancel,
  }: {
    heading: string;
    onSave: () => void;
    onCancel: () => void;
  }) {
    return (
      <div className="catalog-editor">
        <h3 className="catalog-editor-heading">{heading}</h3>
        <div className="catalog-editor-field">
          <label htmlFor="lorebook-title">Title</label>
          <input
            id="lorebook-title"
            className="pondinput"
            type="text"
            value={lorebookDraft.title}
            onChange={(e) =>
              setLorebookDraft({ ...lorebookDraft, title: e.target.value })
            }
            placeholder="e.g. World Notes"
          />
        </div>
        <div className="catalog-editor-field">
          <label htmlFor="lorebook-summary">Summary</label>
          <input
            id="lorebook-summary"
            className="pondinput"
            type="text"
            value={lorebookDraft.summary}
            onChange={(e) =>
              setLorebookDraft({ ...lorebookDraft, summary: e.target.value })
            }
            placeholder="Optional description"
          />
        </div>
        <div className="catalog-editor-actions">
          <button type="button" className="catalog-save-btn" onClick={onSave}>
            Create Lorebook
          </button>
          <button
            type="button"
            className="catalog-cancel-btn"
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (nav.lorebooks.length === 0) {
    return (
      <main className="pond catalog-surface">
        <div className="pond-banner">
          <span className="ic" aria-hidden="true">
            ▤
          </span>
          Lorebooks
          <button
            type="button"
            className="back-btn"
            onClick={() => nav.setView({ kind: "pond" })}
          >
            ← Back to Pond
          </button>
        </div>
        <div className="pond-inner catalog-inner">
          {!showLorebookEditor && (
            <>
              <p className="catalog-empty">
                No lorebooks yet. Create one to start collecting notes and
                continuity material.
              </p>
              <button
                type="button"
                className="catalog-new-btn"
                onClick={openNewLorebook}
              >
                + New Lorebook
              </button>
            </>
          )}
          {showLorebookEditor &&
            renderLorebookEditor({
              heading: "New Lorebook",
              onSave: handleLorebookSave,
              onCancel: handleLorebookCancel,
            })}
        </div>
      </main>
    );
  }

  const entries = activeLorebook?.entries ?? [];

  return (
    <main className="pond catalog-surface">
      <div className="pond-banner">
        <span className="ic" aria-hidden="true">
          ▤
        </span>
        Lorebooks
        <button
          type="button"
          className="back-btn"
          onClick={() => nav.setView({ kind: "pond" })}
        >
          ← Back to Pond
        </button>
      </div>
      <div className="pond-inner catalog-inner">
        {/* Lorebook category selector */}
        <div className="lorebook-tabs" role="tablist" aria-label="Lorebooks">
          {nav.lorebooks.map((lb) => (
            <div
              key={lb.id}
              className={`lorebook-tab${lb.id === selectedLorebookId ? " on" : ""}`}
              role="tab"
              aria-selected={lb.id === selectedLorebookId}
              tabIndex={0}
              onClick={() => {
                setSelectedLorebookId(lb.id);
                setShowEditor(false);
                setDraft(EMPTY_DRAFT);
                setEditingEntryId(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelectedLorebookId(lb.id);
                }
              }}
            >
              <span className="lorebook-tab-title">{lb.title}</span>
              <span className="lorebook-entry-count">{lb.entries.length}</span>
              <span
                className="lorebook-tab-delete"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <DeleteButton
                  ariaLabel={`Delete lorebook ${lb.title}`}
                  onConfirm={() => handleDeleteLorebook(lb.id)}
                />
              </span>
            </div>
          ))}
          <button
            type="button"
            className="lorebook-tab-new"
            aria-label="New lorebook"
            onClick={openNewLorebook}
          >
            + New Lorebook
          </button>
        </div>

        {showLorebookEditor &&
          renderLorebookEditor({
            heading: "New Lorebook",
            onSave: handleLorebookSave,
            onCancel: handleLorebookCancel,
          })}

        {activeLorebook && (
          <div
            className="lorebook-panel"
            role="tabpanel"
            aria-label={activeLorebook.title}
          >
            {activeLorebook.summary && (
              <p className="lorebook-summary">{activeLorebook.summary}</p>
            )}

            <div className="catalog-toolbar">
              <span className="catalog-count">{entries.length} entries</span>
              <button
                type="button"
                className="catalog-new-btn"
                onClick={openNew}
              >
                + New Entry
              </button>
            </div>

            {entries.length === 0 && !showEditor && (
              <p className="catalog-empty">No entries in this lorebook yet.</p>
            )}

            <div className="catalog-list">
              {entries.map((entry) => (
                <article
                  className={`catalog-card${!entry.enabled ? " disabled" : ""}`}
                  key={entry.id}
                >
                  <div className="catalog-card-body">
                    <div className="catalog-card-copy">
                      <b>{entry.title}</b>
                      <span className="catalog-card-summary">{entry.body}</span>
                    </div>
                  </div>
                  <div className="catalog-card-actions">
                    <button
                      type="button"
                      className="catalog-action"
                      aria-label={`Edit ${entry.title}`}
                      onClick={() => openEdit(entry.id)}
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      className="catalog-action"
                      aria-label={`Duplicate ${entry.title}`}
                      onClick={() => handleDuplicate(entry.id)}
                    >
                      ⧉
                    </button>
                    <DeleteButton
                      ariaLabel={`Delete ${entry.title}`}
                      onConfirm={() => handleDelete(entry.id)}
                    />
                  </div>
                </article>
              ))}
            </div>

            {showEditor && (
              <div className="catalog-editor">
                <h3 className="catalog-editor-heading">
                  {editingEntryId ? "Edit Entry" : "New Entry"}
                </h3>
                <div className="catalog-editor-field">
                  <label htmlFor="lore-title">Title</label>
                  <input
                    id="lore-title"
                    className="pondinput"
                    type="text"
                    value={draft.title}
                    onChange={(e) =>
                      setDraft({ ...draft, title: e.target.value })
                    }
                    placeholder="Entry title"
                  />
                </div>
                <div className="catalog-editor-field">
                  <label htmlFor="lore-body">Body</label>
                  <textarea
                    id="lore-body"
                    className="pondinput pondtextarea"
                    rows={4}
                    value={draft.body}
                    onChange={(e) =>
                      setDraft({ ...draft, body: e.target.value })
                    }
                    placeholder="Entry content…"
                  />
                </div>
                <div className="catalog-editor-field catalog-editor-toggle">
                  <span className="catalog-toggle-label">Enabled</span>
                  <Switch
                    checked={draft.enabled}
                    onChange={(v) => setDraft({ ...draft, enabled: v })}
                    ariaLabel="Entry enabled"
                  />
                </div>
                <div className="catalog-editor-actions">
                  <button
                    type="button"
                    className="catalog-save-btn"
                    onClick={handleSave}
                  >
                    {editingEntryId ? "Save Changes" : "Create"}
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
        )}
      </div>
    </main>
  );
}
