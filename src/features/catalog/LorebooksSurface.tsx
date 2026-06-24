import { useState } from "react";
import { useNav } from "../../shared/ui/nav-context";
import type { LorebookEntryInput } from "../../engine/lorebook-actions";
import "./CatalogSurface.css";

interface DraftState {
  title: string;
  body: string;
}

const EMPTY_DRAFT: DraftState = { title: "", body: "" };

function draftFromEntry(entry: {
  title: string;
  body: string;
}): DraftState {
  return { title: entry.title, body: entry.body };
}

function draftToInput(draft: DraftState): LorebookEntryInput {
  return {
    title: draft.title.trim() || "Untitled note",
    body: draft.body.trim(),
    enabled: true,
  };
}

export function LorebooksSurface() {
  const nav = useNav();
  const [selectedLorebookId, setSelectedLorebookId] = useState<string | null>(
    nav.lorebooks[0]?.id ?? null,
  );
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [showEditor, setShowEditor] = useState(false);

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

  if (nav.lorebooks.length === 0) {
    return (
      <main className="pond catalog-surface">
        <div className="pond-banner">
          <span className="ic" aria-hidden="true">▤</span>
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
          <p className="catalog-empty">
            No lorebooks yet. They will appear once created.
          </p>
        </div>
      </main>
    );
  }

  const entries = activeLorebook?.entries ?? [];

  return (
    <main className="pond catalog-surface">
      <div className="pond-banner">
        <span className="ic" aria-hidden="true">▤</span>
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
            <button
              key={lb.id}
              type="button"
              className={`lorebook-tab${lb.id === selectedLorebookId ? " on" : ""}`}
              role="tab"
              aria-selected={lb.id === selectedLorebookId}
              onClick={() => {
                setSelectedLorebookId(lb.id);
                setShowEditor(false);
                setDraft(EMPTY_DRAFT);
                setEditingEntryId(null);
              }}
            >
              {lb.title}
              <span className="lorebook-entry-count">{lb.entries.length}</span>
            </button>
          ))}
        </div>

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
              <span className="catalog-count">
                {entries.length} entries
              </span>
              <button type="button" className="catalog-new-btn" onClick={openNew}>
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
                    <button
                      type="button"
                      className="catalog-action danger"
                      aria-label={`Delete ${entry.title}`}
                      onClick={() => handleDelete(entry.id)}
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
