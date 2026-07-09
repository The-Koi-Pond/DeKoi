import type {
  PromptPresetGroup,
  PromptPresetSection,
  PromptPresetSectionRole,
} from "../../../engine/contracts/types/prompt-presets";
import {
  PROMPT_PRESET_MARKER_TYPES,
  normalizePromptPresetMarkerType,
  promptPresetHasEnabledMarker,
  promptPresetSectionMarkerType,
  promptPresetSectionUsesDepthInsertion,
} from "../../../engine/prompt-presets/prompt-preset-section-policy";
import { CatalogMacroTextarea } from "../shared/CatalogMacroTextarea";
import {
  createPromptPresetDraftGroup,
  createPromptPresetDraftSection,
  movePromptPresetDraftSection,
  removePromptPresetDraftGroup,
  updatePromptPresetDraftSectionKind,
  type PromptPresetDraftState,
} from "./prompt-preset-draft";

interface PromptPresetStructureEditorProps {
  draft: PromptPresetDraftState;
  onDraftChange: (draft: PromptPresetDraftState) => void;
}

interface PromptPresetSectionCardProps {
  draft: PromptPresetDraftState;
  onMove: (sectionId: string, direction: -1 | 1) => void;
  onRemove: (sectionId: string) => void;
  onUpdate: (
    sectionId: string,
    update: (section: PromptPresetSection) => PromptPresetSection,
  ) => void;
  section: PromptPresetSection;
  sectionIndex: number;
}

function readNonNegativeIntegerInput(value: string, fallback: number | null) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  const fallbackValue =
    fallback === null || fallback === undefined ? 0 : Math.max(0, Math.trunc(fallback));
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : fallbackValue;
}

function readSectionRole(value: string): PromptPresetSectionRole {
  return value === "user" || value === "assistant" || value === "system" ? value : "system";
}

function sectionWrapValue(section: PromptPresetSection) {
  if (section.wrapInXml === true) return "xml";
  if (section.wrapInXml === false) return "none";
  return "";
}

function sectionPlacementValue(section: PromptPresetSection) {
  const position = section.injectionPosition ?? "";
  return promptPresetSectionUsesDepthInsertion(section) ? "depth" : position;
}

function updateSectionWrap(section: PromptPresetSection, value: string): PromptPresetSection {
  if (value === "xml") return { ...section, wrapInXml: true };
  if (value === "none") return { ...section, wrapInXml: false };

  const nextSection = { ...section };
  delete nextSection.wrapInXml;
  return nextSection;
}

function PromptPresetGroupsEditor({ draft, onDraftChange }: PromptPresetStructureEditorProps) {
  function updateGroup(groupId: string, update: (group: PromptPresetGroup) => PromptPresetGroup) {
    onDraftChange({
      ...draft,
      groups: draft.groups.map((group) => (group.id === groupId ? update(group) : group)),
    });
  }

  function addGroup() {
    onDraftChange({ ...draft, groups: [...draft.groups, createPromptPresetDraftGroup()] });
  }

  function removeGroup(groupId: string) {
    onDraftChange(removePromptPresetDraftGroup(draft, groupId));
  }

  return (
    <section className="catalog-editor-section" aria-labelledby="preset-groups-heading">
      <div className="catalog-section-heading-row">
        <h4 id="preset-groups-heading">Section Groups</h4>
        <button type="button" className="catalog-new-btn" onClick={addGroup}>
          Add Group
        </button>
      </div>
      <div className="catalog-preset-stack">
        {draft.groups.length === 0 ? (
          <div className="catalog-compact-empty">No groups.</div>
        ) : (
          draft.groups.map((group) => (
            <div className="catalog-preset-row" key={group.id}>
              <div className="catalog-editor-field">
                <label htmlFor={`preset-group-name-${group.id}`}>Name</label>
                <input
                  id={`preset-group-name-${group.id}`}
                  className="pondinput"
                  type="text"
                  value={group.name}
                  onChange={(event) =>
                    updateGroup(group.id, (currentGroup) => ({
                      ...currentGroup,
                      name: event.target.value,
                    }))
                  }
                />
              </div>
              <label className="catalog-checkbox-control">
                <input
                  type="checkbox"
                  checked={group.enabled !== false}
                  onChange={(event) =>
                    updateGroup(group.id, (currentGroup) => ({
                      ...currentGroup,
                      enabled: event.target.checked,
                    }))
                  }
                />
                <span>Enabled</span>
              </label>
              <button
                type="button"
                className="catalog-inline-danger"
                onClick={() => removeGroup(group.id)}
              >
                Remove
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function PromptPresetSectionCard({
  draft,
  onMove,
  onRemove,
  onUpdate,
  section,
  sectionIndex,
}: PromptPresetSectionCardProps) {
  return (
    <div className="catalog-preset-block" key={section.id}>
      <div className="catalog-preset-block-head">
        <b>{section.name.trim() || `Section ${sectionIndex + 1}`}</b>
        <div className="catalog-button-row">
          <button
            type="button"
            className="catalog-mini-btn"
            disabled={sectionIndex === 0}
            onClick={() => onMove(section.id, -1)}
          >
            Move Up
          </button>
          <button
            type="button"
            className="catalog-mini-btn"
            disabled={sectionIndex === draft.sections.length - 1}
            onClick={() => onMove(section.id, 1)}
          >
            Move Down
          </button>
          <button
            type="button"
            className="catalog-inline-danger"
            onClick={() => onRemove(section.id)}
          >
            Remove
          </button>
        </div>
      </div>
      <div className="catalog-editor-grid compact">
        <div className="catalog-editor-field">
          <label htmlFor={`preset-section-name-${section.id}`}>Name</label>
          <input
            id={`preset-section-name-${section.id}`}
            className="pondinput"
            type="text"
            value={section.name}
            onChange={(event) =>
              onUpdate(section.id, (currentSection) => ({
                ...currentSection,
                name: event.target.value,
              }))
            }
          />
        </div>
        {!section.isMarker && (
          <div className="catalog-editor-field">
            <label htmlFor={`preset-section-identifier-${section.id}`}>Identifier</label>
            <input
              id={`preset-section-identifier-${section.id}`}
              className="pondinput"
              type="text"
              value={section.identifier}
              onChange={(event) =>
                onUpdate(section.id, (currentSection) => ({
                  ...currentSection,
                  identifier: event.target.value,
                }))
              }
            />
          </div>
        )}
        <div className="catalog-editor-field">
          <label htmlFor={`preset-section-role-${section.id}`}>Role</label>
          <select
            id={`preset-section-role-${section.id}`}
            className="pondinput"
            value={section.role}
            onChange={(event) =>
              onUpdate(section.id, (currentSection) => ({
                ...currentSection,
                role: readSectionRole(event.target.value),
              }))
            }
          >
            <option value="system">System</option>
            <option value="user">User</option>
            <option value="assistant">Assistant</option>
          </select>
        </div>
      </div>
      <div className="catalog-editor-grid compact">
        <div className="catalog-editor-field">
          <label htmlFor={`preset-section-kind-${section.id}`}>Type</label>
          <select
            id={`preset-section-kind-${section.id}`}
            className="pondinput"
            value={section.isMarker ? "marker" : "section"}
            onChange={(event) =>
              onUpdate(section.id, (currentSection) =>
                updatePromptPresetDraftSectionKind(
                  currentSection,
                  event.target.value === "marker" ? "marker" : "section",
                ),
              )
            }
          >
            <option value="section">Section</option>
            <option value="marker">Marker</option>
          </select>
        </div>
        <div className="catalog-editor-field">
          <label htmlFor={`preset-section-group-${section.id}`}>Group</label>
          <select
            id={`preset-section-group-${section.id}`}
            className="pondinput"
            value={section.groupId ?? ""}
            onChange={(event) =>
              onUpdate(section.id, (currentSection) => ({
                ...currentSection,
                groupId: event.target.value || null,
              }))
            }
          >
            <option value="">None</option>
            {draft.groups.map((group) => (
              <option value={group.id} key={group.id}>
                {group.name.trim() || group.id}
              </option>
            ))}
          </select>
        </div>
        <div className="catalog-editor-field">
          <label htmlFor={`preset-section-placement-${section.id}`}>Placement</label>
          <select
            id={`preset-section-placement-${section.id}`}
            className="pondinput"
            value={sectionPlacementValue(section)}
            onChange={(event) =>
              onUpdate(section.id, (currentSection) => ({
                ...currentSection,
                injectionDepth: event.target.value ? (currentSection.injectionDepth ?? 0) : null,
                injectionPosition: event.target.value || null,
              }))
            }
          >
            <option value="">Prompt Order</option>
            <option value="depth">At Depth</option>
            {section.injectionPosition && sectionPlacementValue(section) !== "depth" && (
              <option value={section.injectionPosition}>Custom: {section.injectionPosition}</option>
            )}
          </select>
        </div>
      </div>
      <div className="catalog-editor-grid compact">
        {section.isMarker ? (
          <div className="catalog-editor-field">
            <label htmlFor={`preset-section-marker-${section.id}`}>Marker Type</label>
            <select
              id={`preset-section-marker-${section.id}`}
              className="pondinput"
              value={promptPresetSectionMarkerType(section)}
              onChange={(event) => {
                const markerType = normalizePromptPresetMarkerType(event.target.value);
                onUpdate(section.id, (currentSection) => ({
                  ...currentSection,
                  identifier: markerType,
                  markerConfig: { type: markerType },
                }));
              }}
            >
              {PROMPT_PRESET_MARKER_TYPES.map((markerType) => (
                <option value={markerType} key={markerType}>
                  {markerType}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="catalog-editor-field">
            <label htmlFor={`preset-section-xml-${section.id}`}>XML Tag</label>
            <input
              id={`preset-section-xml-${section.id}`}
              className="pondinput"
              type="text"
              value={section.xmlTagName ?? ""}
              onChange={(event) =>
                onUpdate(section.id, (currentSection) => ({
                  ...currentSection,
                  xmlTagName: event.target.value,
                }))
              }
              placeholder="Derived from name"
            />
          </div>
        )}
        <div className="catalog-editor-field">
          <label htmlFor={`preset-section-wrap-${section.id}`}>Wrap</label>
          <select
            id={`preset-section-wrap-${section.id}`}
            className="pondinput"
            value={sectionWrapValue(section)}
            onChange={(event) =>
              onUpdate(section.id, (currentSection) =>
                updateSectionWrap(currentSection, event.target.value),
              )
            }
          >
            <option value="">Preset Default</option>
            <option value="xml">XML</option>
            <option value="none">None</option>
          </select>
        </div>
        <div className="catalog-editor-field">
          <label htmlFor={`preset-section-depth-${section.id}`}>Depth</label>
          <input
            id={`preset-section-depth-${section.id}`}
            className="pondinput"
            type="number"
            min="0"
            step="1"
            value={section.injectionDepth?.toString() ?? ""}
            disabled={!promptPresetSectionUsesDepthInsertion(section)}
            onChange={(event) =>
              onUpdate(section.id, (currentSection) => ({
                ...currentSection,
                injectionDepth: readNonNegativeIntegerInput(
                  event.target.value,
                  currentSection.injectionDepth ?? 0,
                ),
              }))
            }
            placeholder="0"
          />
        </div>
      </div>
      <label className="catalog-checkbox-control">
        <input
          type="checkbox"
          checked={section.enabled}
          onChange={(event) =>
            onUpdate(section.id, (currentSection) => ({
              ...currentSection,
              enabled: event.target.checked,
            }))
          }
        />
        <span>Enabled</span>
      </label>
      {!section.isMarker && (
        <div className="catalog-editor-field">
          <label htmlFor={`preset-section-content-${section.id}`}>Content</label>
          <CatalogMacroTextarea
            id={`preset-section-content-${section.id}`}
            className="pondinput pondtextarea"
            rows={8}
            value={section.content}
            onValueChange={(content) =>
              onUpdate(section.id, (currentSection) => ({
                ...currentSection,
                content,
              }))
            }
            placeholder="Prompt section text."
          />
        </div>
      )}
    </div>
  );
}

function PromptPresetSectionsEditor({ draft, onDraftChange }: PromptPresetStructureEditorProps) {
  const hasEnabledChatHistoryMarker = promptPresetHasEnabledMarker(
    draft.sections,
    draft.groups,
    "chat_history",
  );
  const historyHint =
    draft.sections.length > 0
      ? hasEnabledChatHistoryMarker
        ? "Conversation history is included at the enabled Chat History marker."
        : "Conversation history is not included until an enabled Chat History marker is present."
      : "Add sections for structured Roleplay prompts. Conversation history is included only by a Chat History marker.";

  function updateSection(
    sectionId: string,
    update: (section: PromptPresetSection) => PromptPresetSection,
  ) {
    onDraftChange({
      ...draft,
      sections: draft.sections.map((section) =>
        section.id === sectionId ? update(section) : section,
      ),
    });
  }

  function addSection(kind: "section" | "marker") {
    onDraftChange({
      ...draft,
      sections: [...draft.sections, createPromptPresetDraftSection(kind)],
    });
  }

  function removeSection(sectionId: string) {
    onDraftChange({
      ...draft,
      sections: draft.sections.filter((section) => section.id !== sectionId),
    });
  }

  function moveSection(sectionId: string, direction: -1 | 1) {
    onDraftChange({
      ...draft,
      sections: movePromptPresetDraftSection(draft.sections, sectionId, direction),
    });
  }

  return (
    <section className="catalog-editor-section" aria-labelledby="preset-sections-heading">
      <div className="catalog-section-heading-row">
        <h4 id="preset-sections-heading">Roleplay Sections</h4>
        <div className="catalog-button-row">
          <button type="button" className="catalog-new-btn" onClick={() => addSection("section")}>
            Add Section
          </button>
          <button type="button" className="catalog-new-btn" onClick={() => addSection("marker")}>
            Add Marker
          </button>
        </div>
      </div>
      <p
        className={`catalog-field-hint catalog-preset-section-note${
          draft.sections.length > 0 && !hasEnabledChatHistoryMarker ? " warning" : ""
        }`}
      >
        {historyHint}
      </p>
      <div className="catalog-editor-grid compact">
        <div className="catalog-editor-field">
          <label htmlFor="preset-wrap-format">Wrap Format</label>
          <select
            id="preset-wrap-format"
            className="pondinput"
            value={draft.wrapFormat}
            onChange={(event) => onDraftChange({ ...draft, wrapFormat: event.target.value })}
          >
            <option value="">Default XML</option>
            <option value="xml">XML</option>
            <option value="markdown">Markdown</option>
            <option value="none">None</option>
          </select>
        </div>
      </div>
      <div className="catalog-preset-stack">
        {draft.sections.length === 0 ? (
          <div className="catalog-compact-empty">No sections.</div>
        ) : (
          draft.sections.map((section, sectionIndex) => (
            <PromptPresetSectionCard
              draft={draft}
              key={section.id}
              onMove={moveSection}
              onRemove={removeSection}
              onUpdate={updateSection}
              section={section}
              sectionIndex={sectionIndex}
            />
          ))
        )}
      </div>
    </section>
  );
}

export function PromptPresetStructureEditor({
  draft,
  onDraftChange,
}: PromptPresetStructureEditorProps) {
  return (
    <>
      <PromptPresetGroupsEditor draft={draft} onDraftChange={onDraftChange} />
      <PromptPresetSectionsEditor draft={draft} onDraftChange={onDraftChange} />
    </>
  );
}
