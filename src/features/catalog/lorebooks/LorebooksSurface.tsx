import { useState } from "react";
import type {
  NavCatalogState,
  NavLorebookActions,
  NavSettingsState,
  NavViewActions,
  NavViewState,
} from "../../navigation";
import type { LorebookInput } from "../../../engine/catalog/lorebook-actions";
import {
  DEFAULT_LOREBOOK_ACTIVATION,
  type LoreEntryRole,
  type LoreEntryStrategy,
  type LoreInsertionPosition,
} from "../../../engine/contracts/types/lorebook";
import { Switch } from "../../../shared/ui/primitives/Switch";
import { CatalogSurfaceBanner } from "../shared/CatalogSurfaceBanner";
import { DeleteButton } from "../shared/DeleteButton";
import {
  canSaveLorebookEntryDraft,
  entryDraftDisablesBannerSave,
  lorebookEntryDraftToInput,
  parseLorebookEntryKeys,
  readFiniteNumberInput,
  readNonNegativeIntegerInput,
  readNullableNonNegativeIntegerInput,
  readNullablePercentInput,
  type LorebookEntryDraft,
} from "./lorebook-entry-draft";
import { readScanDepthInput } from "./lorebook-scan-depth";
import "../shared/CatalogSurface.css";

interface LorebooksSurfaceProps {
  nav: LorebooksSurfaceNav;
}

export type LorebooksSurfaceNav = Pick<
  NavCatalogState,
  "lorebooks"
> &
  Pick<
    NavLorebookActions,
    | "createLorebook"
    | "createLorebookEntry"
    | "deleteLorebook"
    | "deleteLorebookEntry"
    | "duplicateLorebookEntry"
    | "updateLorebookEntry"
    | "updateLorebook"
  > &
  Pick<NavSettingsState, "appSettings"> &
  Pick<NavViewActions, "setView"> &
  Pick<NavViewState, "view">;

interface LorebookDraftState {
  title: string;
  summary: string;
  scanDepth: string;
  budgetTokens: string;
  budgetPercent: string;
}

const EMPTY_DRAFT: LorebookEntryDraft = {
  title: "",
  body: "",
  enabled: true,
  strategy: "constant",
  key: "",
  insertionOrder: "100",
  insertionPosition: "after-character",
  depth: "0",
  role: "system",
};
const EMPTY_LOREBOOK_DRAFT: LorebookDraftState = {
  title: "",
  summary: "",
  scanDepth: String(DEFAULT_LOREBOOK_ACTIVATION.scanDepth),
  budgetTokens: DEFAULT_LOREBOOK_ACTIVATION.budgetTokens?.toString() ?? "",
  budgetPercent: DEFAULT_LOREBOOK_ACTIVATION.budgetPercent?.toString() ?? "",
};

function draftFromEntry(entry: {
  title: string;
  body: string;
  enabled: boolean;
  strategy: LoreEntryStrategy;
  key: string[] | null;
  insertionOrder: number;
  insertionPosition: LoreInsertionPosition;
  depth: number | null;
  role: LoreEntryRole | null;
}): LorebookEntryDraft {
  return {
    title: entry.title,
    body: entry.body,
    enabled: entry.enabled,
    strategy: entry.strategy,
    key: entry.key?.join(", ") ?? "",
    insertionOrder: String(entry.insertionOrder),
    insertionPosition: entry.insertionPosition,
    depth: String(entry.depth ?? 0),
    role: entry.role ?? "system",
  };
}

function ScanDepthInput({
  fallback,
  id,
  initialValue,
  onCommit,
}: {
  fallback: number;
  id: string;
  initialValue: number;
  onCommit: (scanDepth: number) => void;
}) {
  const [draft, setDraft] = useState(String(initialValue));

  function commitDraft() {
    const scanDepth = readScanDepthInput(draft, fallback);
    setDraft(String(scanDepth));
    onCommit(scanDepth);
  }

  return (
    <input
      id={id}
      className="pondinput"
      type="number"
      min={0}
      step={1}
      value={draft}
      onBlur={commitDraft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) =>
        e.key === "Enter" ? e.currentTarget.blur() : undefined
      }
    />
  );
}

function NullableActivationInput({
  id,
  initialValue,
  max,
  onCommit,
  reader,
}: {
  id: string;
  initialValue: number | null;
  max?: number;
  onCommit: (value: number | null) => void;
  reader: (value: string, fallback: number | null) => number | null;
}) {
  const [draft, setDraft] = useState(initialValue?.toString() ?? "");

  function commitDraft() {
    const parsedValue = reader(draft, initialValue);
    setDraft(parsedValue?.toString() ?? "");
    onCommit(parsedValue);
  }

  return (
    <input
      id={id}
      className="pondinput"
      type="number"
      min={0}
      max={max}
      step={1}
      value={draft}
      onBlur={commitDraft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) =>
        e.key === "Enter" ? e.currentTarget.blur() : undefined
      }
    />
  );
}

export function LorebooksSurface({ nav }: LorebooksSurfaceProps) {
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
  const [draft, setDraft] = useState<LorebookEntryDraft>(EMPTY_DRAFT);
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
    if (!canSaveLorebookEntryDraft(draft)) return;

    const input = lorebookEntryDraftToInput(draft);
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

  function openNewLorebook() {
    setLorebookDraft(EMPTY_LOREBOOK_DRAFT);
    setShowLorebookEditor(true);
  }

  function handleLorebookSave() {
    const budgetTokens = readNullableNonNegativeIntegerInput(
      lorebookDraft.budgetTokens,
      null,
    );
    const budgetPercent =
      budgetTokens === null
        ? readNullablePercentInput(lorebookDraft.budgetPercent, null)
        : null;
    const input: LorebookInput = {
      title: lorebookDraft.title.trim(),
      summary: lorebookDraft.summary.trim(),
      activation: {
        scanDepth: readScanDepthInput(
          lorebookDraft.scanDepth,
          DEFAULT_LOREBOOK_ACTIVATION.scanDepth,
        ),
        budgetTokens,
        budgetPercent,
      },
    };
    if (!input.title) return;
    const lorebook = nav.createLorebook(input);
    setSelectedLorebookId(lorebook.id);
    setShowLorebookEditor(false);
    setLorebookDraft(EMPTY_LOREBOOK_DRAFT);
  }

  function handleDeleteLorebook(lorebookId: string) {
    nav.deleteLorebook(lorebookId);
    if (selectedLorebookId === lorebookId) {
      setSelectedLorebookId(null);
    }
  }

  function commitActiveScanDepth(scanDepth: number) {
    if (!activeLorebook) return;
    if (scanDepth === activeLorebook.activation.scanDepth) return;

    nav.updateLorebook(activeLorebook.id, {
      title: activeLorebook.title,
      summary: activeLorebook.summary,
      activation: {
        ...activeLorebook.activation,
        scanDepth,
      },
    });
  }

  function commitActiveBudgetTokens(budgetTokens: number | null) {
    if (!activeLorebook) return;
    if (budgetTokens === activeLorebook.activation.budgetTokens) return;

    nav.updateLorebook(activeLorebook.id, {
      title: activeLorebook.title,
      summary: activeLorebook.summary,
      activation: {
        ...activeLorebook.activation,
        budgetTokens,
        budgetPercent:
          budgetTokens === null ? activeLorebook.activation.budgetPercent : null,
      },
    });
  }

  function commitActiveBudgetPercent(budgetPercent: number | null) {
    if (!activeLorebook) return;
    if (budgetPercent === activeLorebook.activation.budgetPercent) return;

    nav.updateLorebook(activeLorebook.id, {
      title: activeLorebook.title,
      summary: activeLorebook.summary,
      activation: {
        ...activeLorebook.activation,
        budgetTokens:
          budgetPercent === null ? activeLorebook.activation.budgetTokens : null,
        budgetPercent,
      },
    });
  }

  function renderBanner() {
    const saveAction = showLorebookEditor
      ? handleLorebookSave
      : showEditor
        ? handleSave
        : undefined;
    const saveLabel = showLorebookEditor
      ? "Create Lorebook"
      : editingEntryId
        ? "Save Changes"
        : "Create";
    const saveDisabled = entryDraftDisablesBannerSave({
      draft,
      showEditor,
      showLorebookEditor,
    });
    const deleteAction =
      showEditor && editingEntryId
        ? () => handleDelete(editingEntryId)
        : undefined;

    return (
      <CatalogSurfaceBanner
        icon="▤"
        onBack={() => nav.setView({ kind: "pond" })}
        onDelete={deleteAction}
        onSave={saveAction}
        saveDisabled={saveDisabled}
        saveLabel={saveLabel}
        saveState={saveAction && !saveDisabled ? "pending" : "clean"}
        title="Lorebooks"
      />
    );
  }

  function renderLorebookEditor({
    heading,
  }: {
    heading: string;
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
        <details className="catalog-editor-section" open>
          <summary>Activation</summary>
          <div className="catalog-editor-field">
            <label htmlFor="lorebook-scan-depth">Scan depth</label>
            <input
              id="lorebook-scan-depth"
              className="pondinput"
              type="number"
              min={0}
              step={1}
              value={lorebookDraft.scanDepth}
              onBlur={() =>
                setLorebookDraft({
                  ...lorebookDraft,
                  scanDepth: String(
                    readScanDepthInput(
                      lorebookDraft.scanDepth,
                      DEFAULT_LOREBOOK_ACTIVATION.scanDepth,
                    ),
                  ),
                })
              }
              onChange={(e) =>
                setLorebookDraft({
                  ...lorebookDraft,
                  scanDepth: e.target.value,
                })
              }
            />
          </div>
          <div className="catalog-editor-field">
            <label htmlFor="lorebook-budget-tokens">Budget (tokens)</label>
            <input
              id="lorebook-budget-tokens"
              className="pondinput"
              type="number"
              min={0}
              step={1}
              value={lorebookDraft.budgetTokens}
              onBlur={() =>
                setLorebookDraft({
                  ...lorebookDraft,
                  budgetTokens:
                    readNullableNonNegativeIntegerInput(
                      lorebookDraft.budgetTokens,
                      null,
                    )?.toString() ?? "",
                })
              }
              onChange={(e) =>
                setLorebookDraft({
                  ...lorebookDraft,
                  budgetTokens: e.target.value,
                  budgetPercent: e.target.value.trim()
                    ? ""
                    : lorebookDraft.budgetPercent,
                })
              }
            />
          </div>
          <div className="catalog-editor-field">
            <label htmlFor="lorebook-budget-percent">
              Budget (% of context)
            </label>
            <input
              id="lorebook-budget-percent"
              className="pondinput"
              type="number"
              min={0}
              max={100}
              step={1}
              value={lorebookDraft.budgetPercent}
              onBlur={() =>
                setLorebookDraft({
                  ...lorebookDraft,
                  budgetPercent:
                    readNullablePercentInput(
                      lorebookDraft.budgetPercent,
                      null,
                    )?.toString() ?? "",
                })
              }
              onChange={(e) =>
                setLorebookDraft({
                  ...lorebookDraft,
                  budgetTokens: e.target.value.trim()
                    ? ""
                    : lorebookDraft.budgetTokens,
                  budgetPercent: e.target.value,
                })
              }
            />
          </div>
        </details>
      </div>
    );
  }

  if (nav.lorebooks.length === 0) {
    return (
      <main className="pond catalog-surface">
        {renderBanner()}
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
            })}
        </div>
      </main>
    );
  }

  const entries = activeLorebook?.entries ?? [];

  return (
    <main className="pond catalog-surface">
      {renderBanner()}
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
                  confirmRelease={nav.appSettings.confirmRelease}
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

            <details className="catalog-editor-section lorebook-activation" open>
              <summary>Activation</summary>
              <div className="catalog-editor-field">
                <label htmlFor="active-lorebook-scan-depth">Scan depth</label>
                <ScanDepthInput
                  key={`${activeLorebook.id}:${activeLorebook.activation.scanDepth}`}
                  id="active-lorebook-scan-depth"
                  initialValue={activeLorebook.activation.scanDepth}
                  fallback={activeLorebook.activation.scanDepth}
                  onCommit={commitActiveScanDepth}
                />
              </div>
              <div className="catalog-editor-field">
                <label htmlFor="active-lorebook-budget-tokens">
                  Budget (tokens)
                </label>
                <NullableActivationInput
                  key={`${activeLorebook.id}:tokens:${activeLorebook.activation.budgetTokens ?? "none"}`}
                  id="active-lorebook-budget-tokens"
                  initialValue={activeLorebook.activation.budgetTokens}
                  onCommit={commitActiveBudgetTokens}
                  reader={readNullableNonNegativeIntegerInput}
                />
              </div>
              <div className="catalog-editor-field">
                <label htmlFor="active-lorebook-budget-percent">
                  Budget (% of context)
                </label>
                <NullableActivationInput
                  key={`${activeLorebook.id}:percent:${activeLorebook.activation.budgetPercent ?? "none"}`}
                  id="active-lorebook-budget-percent"
                  initialValue={activeLorebook.activation.budgetPercent}
                  max={100}
                  onCommit={commitActiveBudgetPercent}
                  reader={readNullablePercentInput}
                />
              </div>
            </details>

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
                      confirmRelease={nav.appSettings.confirmRelease}
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
                <div className="catalog-editor-field">
                  <span className="catalog-editor-label">Strategy</span>
                  <div className="catalog-segmented" role="group" aria-label="Strategy">
                    <button
                      type="button"
                      aria-pressed={draft.strategy === "constant"}
                      className={`catalog-segment${draft.strategy === "constant" ? " on" : ""}`}
                      onClick={() => setDraft({ ...draft, strategy: "constant" })}
                    >
                      Constant
                    </button>
                    <button
                      type="button"
                      aria-pressed={draft.strategy === "selective"}
                      className={`catalog-segment${draft.strategy === "selective" ? " on" : ""}`}
                      onClick={() => setDraft({ ...draft, strategy: "selective" })}
                    >
                      Selective
                    </button>
                  </div>
                </div>
                <div className="catalog-editor-field">
                  <label htmlFor="lore-key">Key</label>
                  <input
                    id="lore-key"
                    className="pondinput"
                    type="text"
                    value={draft.key}
                    onChange={(e) =>
                      setDraft({ ...draft, key: e.target.value })
                    }
                    placeholder="keyword, another keyword"
                  />
                  {draft.strategy === "selective" &&
                    !parseLorebookEntryKeys(draft.key) && (
                      <p className="catalog-field-hint">
                        Selective entries need at least one key to activate.
                      </p>
                    )}
                </div>
                <div className="catalog-editor-field">
                  <label htmlFor="lore-insertion-order">Insertion Order</label>
                  <input
                    id="lore-insertion-order"
                    className="pondinput"
                    type="number"
                    step={1}
                    value={draft.insertionOrder}
                    onBlur={() =>
                      setDraft({
                        ...draft,
                        insertionOrder: String(
                          readFiniteNumberInput(draft.insertionOrder, 100),
                        ),
                      })
                    }
                    onChange={(e) =>
                      setDraft({ ...draft, insertionOrder: e.target.value })
                    }
                  />
                </div>
                <div className="catalog-editor-field">
                  <label htmlFor="lore-insertion-position">
                    Insertion Position
                  </label>
                  <select
                    id="lore-insertion-position"
                    className="pondinput"
                    value={draft.insertionPosition}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        insertionPosition: e.target.value as LoreInsertionPosition,
                      })
                    }
                  >
                    <option value="before-character">Before Character</option>
                    <option value="after-character">After Character</option>
                    <option value="at-depth">At Depth</option>
                  </select>
                </div>
                {draft.insertionPosition === "at-depth" && (
                  <>
                    <div className="catalog-editor-field">
                      <label htmlFor="lore-depth">Depth</label>
                      <input
                        id="lore-depth"
                        className="pondinput"
                        type="number"
                        min={0}
                        step={1}
                        value={draft.depth}
                        onBlur={() =>
                          setDraft({
                            ...draft,
                            depth: String(
                              readNonNegativeIntegerInput(draft.depth, 0),
                            ),
                          })
                        }
                        onChange={(e) =>
                          setDraft({ ...draft, depth: e.target.value })
                        }
                      />
                    </div>
                    <div className="catalog-editor-field">
                      <label htmlFor="lore-role">Role</label>
                      <select
                        id="lore-role"
                        className="pondinput"
                        value={draft.role}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            role: e.target.value as LoreEntryRole,
                          })
                        }
                      >
                        <option value="system">System</option>
                        <option value="user">User</option>
                        <option value="assistant">Assistant</option>
                      </select>
                    </div>
                  </>
                )}
                <div className="catalog-editor-field catalog-editor-toggle">
                  <span className="catalog-toggle-label">Enabled</span>
                  <Switch
                    checked={draft.enabled}
                    onChange={(v) => setDraft({ ...draft, enabled: v })}
                    ariaLabel="Entry enabled"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
