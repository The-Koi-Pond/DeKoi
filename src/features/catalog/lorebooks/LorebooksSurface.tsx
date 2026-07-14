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
  DEFAULT_LORE_ENTRY_TIMING,
  DEFAULT_LORE_ENTRY_RECURSION,
  DEFAULT_LOREBOOK_ACTIVATION,
  type LorebookActivationSettings,
  type LoreEntryRole,
  type LoreInsertionPosition,
  type LoreSelectiveLogic,
} from "../../../engine/contracts/types/lorebook";
import { Switch } from "../../../shared/ui/primitives/Switch";
import { NullableActivationInput } from "../shared/ActivationInputs";
import { CatalogMacroTextarea } from "../shared/CatalogMacroTextarea";
import { CatalogSurfaceBanner } from "../shared/CatalogSurfaceBanner";
import { DeleteButton } from "../shared/DeleteButton";
import {
  canSaveLorebookEntryDraft,
  entryDraftDisablesBannerSave,
  EMPTY_LORE_MATCH_SOURCES,
  lorebookEntryDraftFromRecord,
  lorebookEntryDraftToInput,
  parseLorebookEntryKeys,
  readFiniteNumberInput,
  readNonNegativeIntegerInput,
  readNullableNonNegativeIntegerInput,
  readNullablePercentInput,
  type LorebookEntryDraft,
} from "./lorebook-entry-draft";
import { EntryInclusionControls } from "./EntryInclusionControls";
import { EntryCharacterFilterControls } from "./EntryCharacterFilterControls";
import { EntryMatchSourceControls } from "./EntryMatchSourceControls";
import { EntryRecursionControls } from "./EntryRecursionControls";
import { EntryTimingControls } from "./EntryTimingControls";
import { EntryTriggerControls } from "./EntryTriggerControls";
import { LorebookGroupScoringActivationField } from "./LorebookGroupScoringActivationField";
import { LorebookRecursionActivationFields } from "./LorebookRecursionActivationFields";
import { readScanDepthInput } from "./lorebook-scan-depth";
import "../shared/CatalogSurface.css";

interface LorebooksSurfaceProps {
  nav: LorebooksSurfaceNav;
}

export type LorebooksSurfaceNav = Pick<NavCatalogState, "characters" | "lorebooks"> &
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
  includeNames: boolean;
  caseSensitiveKeys: boolean;
  matchWholeWords: boolean;
  recursiveScan: boolean;
  maxRecursionSteps: string;
  useGroupScoring: boolean;
  budgetTokens: string;
  budgetPercent: string;
}

const EMPTY_DRAFT: LorebookEntryDraft = {
  title: "",
  body: "",
  enabled: true,
  strategy: "constant",
  key: "",
  keySecondary: "",
  selectiveLogic: "and-any",
  probability: "100",
  inclusionGroup: "",
  groupWeight: "100",
  prioritizeInclusion: false,
  insertionOrder: "100",
  insertionPosition: "after-character",
  depth: "0",
  role: "system",
  nonRecursable: DEFAULT_LORE_ENTRY_RECURSION.nonRecursable,
  preventFurther: DEFAULT_LORE_ENTRY_RECURSION.preventFurther,
  delayUntilRecursion: DEFAULT_LORE_ENTRY_RECURSION.delayUntilRecursion,
  recursionLevel: String(DEFAULT_LORE_ENTRY_RECURSION.recursionLevel),
  sticky: String(DEFAULT_LORE_ENTRY_TIMING.sticky),
  cooldown: String(DEFAULT_LORE_ENTRY_TIMING.cooldown),
  delay: String(DEFAULT_LORE_ENTRY_TIMING.delay),
  matchSources: EMPTY_LORE_MATCH_SOURCES,
  triggers: null,
  characterFilter: null,
};
const EMPTY_LOREBOOK_DRAFT: LorebookDraftState = {
  title: "",
  summary: "",
  scanDepth: String(DEFAULT_LOREBOOK_ACTIVATION.scanDepth),
  includeNames: DEFAULT_LOREBOOK_ACTIVATION.includeNames,
  caseSensitiveKeys: DEFAULT_LOREBOOK_ACTIVATION.caseSensitiveKeys,
  matchWholeWords: DEFAULT_LOREBOOK_ACTIVATION.matchWholeWords,
  recursiveScan: DEFAULT_LOREBOOK_ACTIVATION.recursiveScan,
  maxRecursionSteps: String(DEFAULT_LOREBOOK_ACTIVATION.maxRecursionSteps),
  useGroupScoring: DEFAULT_LOREBOOK_ACTIVATION.useGroupScoring,
  budgetTokens: DEFAULT_LOREBOOK_ACTIVATION.budgetTokens?.toString() ?? "",
  budgetPercent: DEFAULT_LOREBOOK_ACTIVATION.budgetPercent?.toString() ?? "",
};

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
      onKeyDown={(e) => (e.key === "Enter" ? e.currentTarget.blur() : undefined)}
    />
  );
}

export function LorebooksSurface({ nav }: LorebooksSurfaceProps) {
  const routedLorebookId = nav.view.kind === "lorebooks" ? nav.view.lorebookId : null;
  const initialLorebookId =
    routedLorebookId && nav.lorebooks.some((lorebook) => lorebook.id === routedLorebookId)
      ? routedLorebookId
      : (nav.lorebooks[0]?.id ?? null);
  const [selectedLorebookId, setSelectedLorebookId] = useState<string | null>(initialLorebookId);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [draft, setDraft] = useState<LorebookEntryDraft>(EMPTY_DRAFT);
  const [showEditor, setShowEditor] = useState(false);
  const [showLorebookEditor, setShowLorebookEditor] = useState(
    nav.view.kind === "lorebooks" && nav.view.mode === "new-lorebook",
  );
  const [lorebookDraft, setLorebookDraft] = useState<LorebookDraftState>(EMPTY_LOREBOOK_DRAFT);

  const activeLorebook = nav.lorebooks.find((lb) => lb.id === selectedLorebookId);

  function openNew() {
    setDraft(EMPTY_DRAFT);
    setEditingEntryId(null);
    setShowEditor(true);
  }

  function openEdit(entryId: string) {
    const entry = activeLorebook?.entries.find((e) => e.id === entryId);
    if (!entry) return;
    setDraft(lorebookEntryDraftFromRecord(entry));
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
    const budgetTokens = readNullableNonNegativeIntegerInput(lorebookDraft.budgetTokens, null);
    const budgetPercent =
      budgetTokens === null ? readNullablePercentInput(lorebookDraft.budgetPercent, null) : null;
    const input: LorebookInput = {
      title: lorebookDraft.title.trim(),
      summary: lorebookDraft.summary.trim(),
      activation: {
        scanDepth: readScanDepthInput(
          lorebookDraft.scanDepth,
          DEFAULT_LOREBOOK_ACTIVATION.scanDepth,
        ),
        includeNames: lorebookDraft.includeNames,
        caseSensitiveKeys: lorebookDraft.caseSensitiveKeys,
        matchWholeWords: lorebookDraft.matchWholeWords,
        recursiveScan: lorebookDraft.recursiveScan,
        maxRecursionSteps: readNonNegativeIntegerInput(
          lorebookDraft.maxRecursionSteps,
          DEFAULT_LOREBOOK_ACTIVATION.maxRecursionSteps,
        ),
        useGroupScoring: lorebookDraft.useGroupScoring,
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

  function patchActiveActivation(patch: Partial<LorebookActivationSettings>) {
    if (!activeLorebook) return;
    const changed = (Object.keys(patch) as (keyof LorebookActivationSettings)[]).some(
      (key) => activeLorebook.activation[key] !== patch[key],
    );
    if (!changed) return;

    nav.updateLorebook(activeLorebook.id, {
      title: activeLorebook.title,
      summary: activeLorebook.summary,
      activation: {
        ...activeLorebook.activation,
        ...patch,
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
      showEditor && editingEntryId ? () => handleDelete(editingEntryId) : undefined;

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

  function renderLorebookEditor({ heading }: { heading: string }) {
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
            onChange={(e) => setLorebookDraft({ ...lorebookDraft, title: e.target.value })}
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
            onChange={(e) => setLorebookDraft({ ...lorebookDraft, summary: e.target.value })}
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
          <div className="catalog-editor-field catalog-editor-toggle">
            <span className="catalog-toggle-label">Include names</span>
            <Switch
              checked={lorebookDraft.includeNames}
              onChange={(includeNames) =>
                setLorebookDraft({
                  ...lorebookDraft,
                  includeNames,
                })
              }
              ariaLabel="Include names"
            />
          </div>
          <div className="catalog-editor-field catalog-editor-toggle">
            <span className="catalog-toggle-label">Case-sensitive keys</span>
            <Switch
              checked={lorebookDraft.caseSensitiveKeys}
              onChange={(caseSensitiveKeys) =>
                setLorebookDraft({
                  ...lorebookDraft,
                  caseSensitiveKeys,
                })
              }
              ariaLabel="Case-sensitive keys"
            />
          </div>
          <div className="catalog-editor-field catalog-editor-toggle">
            <span className="catalog-toggle-label">Match whole words</span>
            <Switch
              checked={lorebookDraft.matchWholeWords}
              onChange={(matchWholeWords) =>
                setLorebookDraft({
                  ...lorebookDraft,
                  matchWholeWords,
                })
              }
              ariaLabel="Match whole words"
            />
          </div>
          <LorebookRecursionActivationFields
            recursiveScan={lorebookDraft.recursiveScan}
            onRecursiveScanChange={(recursiveScan) =>
              setLorebookDraft({
                ...lorebookDraft,
                recursiveScan,
              })
            }
            maxRecursionStepsInput={{
              id: "lorebook-max-recursion-steps",
              value: lorebookDraft.maxRecursionSteps,
              onChange: (maxRecursionSteps) =>
                setLorebookDraft({
                  ...lorebookDraft,
                  maxRecursionSteps,
                }),
              fallback: DEFAULT_LOREBOOK_ACTIVATION.maxRecursionSteps,
              onCommit: (maxRecursionSteps) =>
                setLorebookDraft({
                  ...lorebookDraft,
                  maxRecursionSteps: String(maxRecursionSteps),
                }),
              reader: readNonNegativeIntegerInput,
            }}
          />
          <LorebookGroupScoringActivationField
            useGroupScoring={lorebookDraft.useGroupScoring}
            onUseGroupScoringChange={(useGroupScoring) =>
              setLorebookDraft({
                ...lorebookDraft,
                useGroupScoring,
              })
            }
          />
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
                  budgetPercent: e.target.value.trim() ? "" : lorebookDraft.budgetPercent,
                })
              }
            />
          </div>
          <div className="catalog-editor-field">
            <label htmlFor="lorebook-budget-percent">Budget (% of context)</label>
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
                    readNullablePercentInput(lorebookDraft.budgetPercent, null)?.toString() ?? "",
                })
              }
              onChange={(e) =>
                setLorebookDraft({
                  ...lorebookDraft,
                  budgetTokens: e.target.value.trim() ? "" : lorebookDraft.budgetTokens,
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
                No lorebooks yet. Create one to start collecting notes and continuity material.
              </p>
              <button type="button" className="catalog-new-btn" onClick={openNewLorebook}>
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
          <div className="lorebook-panel" role="tabpanel" aria-label={activeLorebook.title}>
            {activeLorebook.summary && <p className="lorebook-summary">{activeLorebook.summary}</p>}

            <details className="catalog-editor-section lorebook-activation" open>
              <summary>Activation</summary>
              <div className="catalog-editor-field">
                <label htmlFor="active-lorebook-scan-depth">Scan depth</label>
                <ScanDepthInput
                  key={`${activeLorebook.id}:${activeLorebook.activation.scanDepth}`}
                  id="active-lorebook-scan-depth"
                  initialValue={activeLorebook.activation.scanDepth}
                  fallback={activeLorebook.activation.scanDepth}
                  onCommit={(scanDepth) => patchActiveActivation({ scanDepth })}
                />
              </div>
              <div className="catalog-editor-field catalog-editor-toggle">
                <span className="catalog-toggle-label">Include names</span>
                <Switch
                  checked={activeLorebook.activation.includeNames}
                  onChange={(includeNames) => patchActiveActivation({ includeNames })}
                  ariaLabel="Include names"
                />
              </div>
              <div className="catalog-editor-field catalog-editor-toggle">
                <span className="catalog-toggle-label">Case-sensitive keys</span>
                <Switch
                  checked={activeLorebook.activation.caseSensitiveKeys}
                  onChange={(caseSensitiveKeys) => patchActiveActivation({ caseSensitiveKeys })}
                  ariaLabel="Case-sensitive keys"
                />
              </div>
              <div className="catalog-editor-field catalog-editor-toggle">
                <span className="catalog-toggle-label">Match whole words</span>
                <Switch
                  checked={activeLorebook.activation.matchWholeWords}
                  onChange={(matchWholeWords) => patchActiveActivation({ matchWholeWords })}
                  ariaLabel="Match whole words"
                />
              </div>
              <LorebookRecursionActivationFields
                key={`${activeLorebook.id}:recursion:${activeLorebook.activation.maxRecursionSteps}`}
                recursiveScan={activeLorebook.activation.recursiveScan}
                onRecursiveScanChange={(recursiveScan) => patchActiveActivation({ recursiveScan })}
                maxRecursionStepsInput={{
                  id: "active-lorebook-max-recursion-steps",
                  initialValue: activeLorebook.activation.maxRecursionSteps,
                  fallback: activeLorebook.activation.maxRecursionSteps,
                  onCommit: (maxRecursionSteps) => patchActiveActivation({ maxRecursionSteps }),
                  reader: readNonNegativeIntegerInput,
                }}
              />
              <LorebookGroupScoringActivationField
                useGroupScoring={activeLorebook.activation.useGroupScoring}
                onUseGroupScoringChange={(useGroupScoring) =>
                  patchActiveActivation({ useGroupScoring })
                }
              />
              <div className="catalog-editor-field">
                <label htmlFor="active-lorebook-budget-tokens">Budget (tokens)</label>
                <NullableActivationInput
                  key={`${activeLorebook.id}:tokens:${activeLorebook.activation.budgetTokens ?? "none"}`}
                  id="active-lorebook-budget-tokens"
                  initialValue={activeLorebook.activation.budgetTokens}
                  onCommit={(budgetTokens) =>
                    patchActiveActivation({
                      budgetTokens,
                      budgetPercent:
                        budgetTokens === null ? activeLorebook.activation.budgetPercent : null,
                    })
                  }
                  reader={readNullableNonNegativeIntegerInput}
                />
              </div>
              <div className="catalog-editor-field">
                <label htmlFor="active-lorebook-budget-percent">Budget (% of context)</label>
                <NullableActivationInput
                  key={`${activeLorebook.id}:percent:${activeLorebook.activation.budgetPercent ?? "none"}`}
                  id="active-lorebook-budget-percent"
                  initialValue={activeLorebook.activation.budgetPercent}
                  max={100}
                  onCommit={(budgetPercent) =>
                    patchActiveActivation({
                      budgetTokens:
                        budgetPercent === null ? activeLorebook.activation.budgetTokens : null,
                      budgetPercent,
                    })
                  }
                  reader={readNullablePercentInput}
                />
              </div>
            </details>

            <div className="catalog-toolbar">
              <span className="catalog-count">{entries.length} entries</span>
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
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    placeholder="Entry title"
                  />
                </div>
                <div className="catalog-editor-field">
                  <label htmlFor="lore-body">Body</label>
                  <CatalogMacroTextarea
                    id="lore-body"
                    className="pondinput pondtextarea"
                    rows={4}
                    value={draft.body}
                    onValueChange={(body) => setDraft({ ...draft, body })}
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
                    onChange={(e) => setDraft({ ...draft, key: e.target.value })}
                    placeholder="keyword, another keyword"
                  />
                  {draft.strategy === "selective" && !parseLorebookEntryKeys(draft.key) && (
                    <p className="catalog-field-hint">
                      Selective entries need at least one key to activate.
                    </p>
                  )}
                  <p className="catalog-field-hint">
                    Regex keys use /pattern/flags and activate during generation.
                  </p>
                </div>
                <div className="catalog-editor-field">
                  <label htmlFor="lore-key-secondary">Optional Filter</label>
                  <input
                    id="lore-key-secondary"
                    className="pondinput"
                    type="text"
                    value={draft.keySecondary}
                    onChange={(e) => setDraft({ ...draft, keySecondary: e.target.value })}
                    placeholder="secondary keyword, another filter"
                  />
                  <p className="catalog-field-hint">
                    Optional filters also support /pattern/flags regex keys.
                  </p>
                </div>
                {parseLorebookEntryKeys(draft.keySecondary) && (
                  <div className="catalog-editor-field">
                    <label htmlFor="lore-selective-logic">Selective Logic</label>
                    <select
                      id="lore-selective-logic"
                      className="pondinput"
                      value={draft.selectiveLogic}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          selectiveLogic: e.target.value as LoreSelectiveLogic,
                        })
                      }
                    >
                      <option value="and-any">AND ANY</option>
                      <option value="and-all">AND ALL</option>
                      <option value="not-any">NOT ANY</option>
                      <option value="not-all">NOT ALL</option>
                    </select>
                  </div>
                )}
                <EntryInclusionControls draft={draft} onDraftChange={setDraft} />
                <EntryTriggerControls draft={draft} onDraftChange={setDraft} />
                <EntryCharacterFilterControls
                  characters={nav.characters}
                  draft={draft}
                  onDraftChange={setDraft}
                />
                <EntryMatchSourceControls draft={draft} onDraftChange={setDraft} />
                <EntryRecursionControls draft={draft} onDraftChange={setDraft} />
                <EntryTimingControls draft={draft} onDraftChange={setDraft} />
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
                        insertionOrder: String(readFiniteNumberInput(draft.insertionOrder, 100)),
                      })
                    }
                    onChange={(e) => setDraft({ ...draft, insertionOrder: e.target.value })}
                  />
                </div>
                <div className="catalog-editor-field">
                  <label htmlFor="lore-insertion-position">Insertion Position</label>
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
                            depth: String(readNonNegativeIntegerInput(draft.depth, 0)),
                          })
                        }
                        onChange={(e) => setDraft({ ...draft, depth: e.target.value })}
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
