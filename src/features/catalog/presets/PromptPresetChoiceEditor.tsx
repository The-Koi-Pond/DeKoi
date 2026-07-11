import type { PromptPresetChoiceBlock } from "../../../engine/contracts/types/prompt-presets";
import {
  addPromptPresetChoiceBlock,
  addPromptPresetChoiceOption,
  movePromptPresetChoiceBlock,
  movePromptPresetChoiceOption,
  promptPresetChoiceVisibilityOptions,
  removePromptPresetChoiceBlock,
  removePromptPresetChoiceOption,
  renamePromptPresetChoiceVariable,
  setPromptPresetChoiceDefault,
  setPromptPresetChoiceVisibilityController,
  setPromptPresetChoiceVisibilityValue,
  updatePromptPresetChoiceBlock,
  updatePromptPresetChoiceOption,
  validatePromptPresetChoiceDraft,
  type PromptPresetChoiceDraftState,
} from "./prompt-preset-choice-draft";
import type { PromptPresetDraftState } from "./prompt-preset-draft";

interface PromptPresetChoiceEditorProps {
  draft: PromptPresetDraftState;
  onDraftChange: (draft: PromptPresetDraftState) => void;
}

interface ChoiceBlockCardProps {
  block: PromptPresetChoiceBlock;
  blockIndex: number;
  choiceDraft: PromptPresetChoiceDraftState;
  issues: string[];
  onAddOption: (blockId: string) => void;
  onMove: (blockId: string, direction: -1 | 1) => void;
  onMoveOption: (blockId: string, optionId: string, direction: -1 | 1) => void;
  onRemove: (blockId: string) => void;
  onRemoveOption: (blockId: string, optionId: string) => void;
  onRenameVariable: (blockId: string, variableName: string) => void;
  onSetDefault: (blockId: string, optionId: string, selected: boolean) => void;
  onSetVisibilityController: (blockId: string, controllerId: string | null) => void;
  onSetVisibilityValue: (blockId: string, value: string, selected: boolean) => void;
  onUpdate: (
    blockId: string,
    update: (block: PromptPresetChoiceBlock) => PromptPresetChoiceBlock,
  ) => void;
  onUpdateOption: (
    blockId: string,
    optionId: string,
    update: (
      option: PromptPresetChoiceBlock["options"][number],
    ) => PromptPresetChoiceBlock["options"][number],
  ) => void;
}

function currentChoiceDraft(draft: PromptPresetDraftState): PromptPresetChoiceDraftState {
  return {
    choiceBlocks: draft.choiceBlocks,
    defaultOptionIdsByBlockId: draft.defaultOptionIdsByBlockId,
    visibilityControllerIdsByBlockId: draft.visibilityControllerIdsByBlockId,
  };
}

function mergeChoiceDraft(
  draft: PromptPresetDraftState,
  choiceDraft: PromptPresetChoiceDraftState,
): PromptPresetDraftState {
  return { ...draft, ...choiceDraft };
}

function readDisplayMode(value: string): PromptPresetChoiceBlock["displayMode"] {
  return value === "buttons" || value === "listbox" ? value : "auto";
}

function readOptionSort(value: string): PromptPresetChoiceBlock["optionSort"] {
  return value === "alphabetical" ? "alphabetical" : "manual";
}

function domIdSegment(value: string) {
  return value
    .split("")
    .map((character) => character.charCodeAt(0).toString(16).padStart(4, "0"))
    .join("");
}

function choiceOptionFieldId(field: string, blockId: string, optionId: string) {
  return `preset-choice-option-${field}-${domIdSegment(blockId)}-${domIdSegment(optionId)}`;
}

function ChoiceVisibilityEditor({
  block,
  choiceDraft,
  onSetVisibilityController,
  onSetVisibilityValue,
}: Pick<
  ChoiceBlockCardProps,
  "block" | "choiceDraft" | "onSetVisibilityController" | "onSetVisibilityValue"
>) {
  const controllers = choiceDraft.choiceBlocks.filter((candidate) => candidate.id !== block.id);
  const controllerId = choiceDraft.visibilityControllerIdsByBlockId[block.id];
  const controller = controllers.find((candidate) => candidate.id === controllerId);
  const controllerValues = controller ? promptPresetChoiceVisibilityOptions(controller) : [];

  return (
    <div className="catalog-choice-visibility">
      <div className="catalog-editor-field">
        <label htmlFor={`preset-choice-visibility-controller-${block.id}`}>Show When</label>
        <select
          id={`preset-choice-visibility-controller-${block.id}`}
          className="pondinput"
          value={controller?.id ?? ""}
          onChange={(event) => onSetVisibilityController(block.id, event.target.value || null)}
        >
          <option value="">Always visible</option>
          {controllers.map((candidate) => (
            <option value={candidate.id} key={candidate.id}>
              {candidate.label.trim() || candidate.variableName.trim() || "Unnamed choice"}
            </option>
          ))}
        </select>
      </div>
      {controller && (
        <fieldset className="catalog-choice-defaults">
          <legend>Controller values</legend>
          {controllerValues.length === 0 ? (
            <span className="catalog-field-hint">Add a non-empty value to the controller.</span>
          ) : (
            controllerValues.map((option) => {
              const checked =
                block.visibilityRule?.values.some((value) => value.trim() === option.value) ??
                false;
              return (
                <label className="catalog-checkbox-control" key={option.value}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) =>
                      onSetVisibilityValue(block.id, option.value, event.target.checked)
                    }
                  />
                  <span>{option.label.trim() || option.value}</span>
                </label>
              );
            })
          )}
        </fieldset>
      )}
    </div>
  );
}

function ChoiceBlockCard({
  block,
  blockIndex,
  choiceDraft,
  issues,
  onAddOption,
  onMove,
  onMoveOption,
  onRemove,
  onRemoveOption,
  onRenameVariable,
  onSetDefault,
  onSetVisibilityController,
  onSetVisibilityValue,
  onUpdate,
  onUpdateOption,
}: ChoiceBlockCardProps) {
  const defaultOptionIds = choiceDraft.defaultOptionIdsByBlockId[block.id] ?? [];
  const manualOrder = (block.optionSort ?? "manual") === "manual";

  return (
    <div className="catalog-preset-block">
      <div className="catalog-preset-block-head">
        <b>{block.label.trim() || `Choice ${blockIndex + 1}`}</b>
        <div className="catalog-button-row">
          <button
            type="button"
            className="catalog-mini-btn"
            disabled={blockIndex === 0}
            onClick={() => onMove(block.id, -1)}
          >
            Move Up
          </button>
          <button
            type="button"
            className="catalog-mini-btn"
            disabled={blockIndex === choiceDraft.choiceBlocks.length - 1}
            onClick={() => onMove(block.id, 1)}
          >
            Move Down
          </button>
          <button
            type="button"
            className="catalog-inline-danger"
            onClick={() => onRemove(block.id)}
          >
            Remove
          </button>
        </div>
      </div>

      {issues.length > 0 && (
        <ul className="catalog-choice-errors" role="alert">
          {issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      )}

      <div className="catalog-editor-grid compact">
        <div className="catalog-editor-field">
          <label htmlFor={`preset-choice-variable-${block.id}`}>Variable</label>
          <input
            id={`preset-choice-variable-${block.id}`}
            className="pondinput"
            type="text"
            value={block.variableName}
            onChange={(event) => onRenameVariable(block.id, event.target.value)}
            placeholder="e.g. tone"
          />
        </div>
        <div className="catalog-editor-field">
          <label htmlFor={`preset-choice-label-${block.id}`}>Label</label>
          <input
            id={`preset-choice-label-${block.id}`}
            className="pondinput"
            type="text"
            value={block.label}
            onChange={(event) =>
              onUpdate(block.id, (currentBlock) => ({
                ...currentBlock,
                label: event.target.value,
              }))
            }
            placeholder="e.g. Tone"
          />
        </div>
        <div className="catalog-editor-field">
          <label htmlFor={`preset-choice-question-${block.id}`}>Question</label>
          <input
            id={`preset-choice-question-${block.id}`}
            className="pondinput"
            type="text"
            value={block.question ?? ""}
            onChange={(event) =>
              onUpdate(block.id, (currentBlock) => ({
                ...currentBlock,
                question: event.target.value || null,
              }))
            }
            placeholder="Optional prompt shown with this choice"
          />
        </div>
      </div>

      <div className="catalog-choice-options">
        {block.options.map((option, optionIndex) => {
          const isDefault = defaultOptionIds.includes(option.id);
          const labelFieldId = choiceOptionFieldId("label", block.id, option.id);
          const valueFieldId = choiceOptionFieldId("value", block.id, option.id);
          const descriptionFieldId = choiceOptionFieldId("description", block.id, option.id);
          return (
            <div className="catalog-choice-option" key={option.id}>
              <div className="catalog-choice-option-head">
                <b>{option.label.trim() || `Option ${optionIndex + 1}`}</b>
                <div className="catalog-button-row">
                  <button
                    type="button"
                    className="catalog-mini-btn"
                    disabled={!manualOrder || optionIndex === 0}
                    onClick={() => onMoveOption(block.id, option.id, -1)}
                  >
                    Up
                  </button>
                  <button
                    type="button"
                    className="catalog-mini-btn"
                    disabled={!manualOrder || optionIndex === block.options.length - 1}
                    onClick={() => onMoveOption(block.id, option.id, 1)}
                  >
                    Down
                  </button>
                  <button
                    type="button"
                    className="catalog-inline-danger"
                    disabled={block.options.length <= 1}
                    onClick={() => onRemoveOption(block.id, option.id)}
                  >
                    Remove
                  </button>
                </div>
              </div>
              <div className="catalog-editor-grid compact">
                <div className="catalog-editor-field">
                  <label htmlFor={labelFieldId}>Option Label</label>
                  <input
                    id={labelFieldId}
                    className="pondinput"
                    type="text"
                    value={option.label}
                    onChange={(event) =>
                      onUpdateOption(block.id, option.id, (currentOption) => ({
                        ...currentOption,
                        label: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="catalog-editor-field">
                  <label htmlFor={valueFieldId}>Value</label>
                  <input
                    id={valueFieldId}
                    className="pondinput"
                    type="text"
                    value={option.value}
                    onChange={(event) =>
                      onUpdateOption(block.id, option.id, (currentOption) => ({
                        ...currentOption,
                        value: event.target.value,
                      }))
                    }
                    placeholder="Prompt variable value"
                  />
                </div>
                <div className="catalog-editor-field">
                  <label htmlFor={descriptionFieldId}>Description</label>
                  <input
                    id={descriptionFieldId}
                    className="pondinput"
                    type="text"
                    value={option.description ?? ""}
                    onChange={(event) =>
                      onUpdateOption(block.id, option.id, (currentOption) => ({
                        ...currentOption,
                        description: event.target.value || null,
                      }))
                    }
                    placeholder="Optional"
                  />
                </div>
              </div>
              <label className="catalog-checkbox-control catalog-choice-default-control">
                <input
                  type={block.multiSelect ? "checkbox" : "radio"}
                  name={`preset-choice-default-${block.id}`}
                  checked={isDefault}
                  onChange={(event) => onSetDefault(block.id, option.id, event.target.checked)}
                />
                <span>Preset default</span>
              </label>
            </div>
          );
        })}
      </div>

      <button type="button" className="catalog-new-btn" onClick={() => onAddOption(block.id)}>
        Add Option
      </button>

      <details className="catalog-choice-advanced">
        <summary>Advanced choice settings</summary>
        <div className="catalog-editor-grid compact">
          <label className="catalog-checkbox-control">
            <input
              type="checkbox"
              checked={block.multiSelect === true}
              onChange={(event) =>
                onUpdate(block.id, (currentBlock) => ({
                  ...currentBlock,
                  multiSelect: event.target.checked,
                }))
              }
            />
            <span>Allow multiple selections</span>
          </label>
          <div className="catalog-editor-field">
            <label htmlFor={`preset-choice-display-${block.id}`}>Display</label>
            <select
              id={`preset-choice-display-${block.id}`}
              className="pondinput"
              value={block.displayMode ?? "auto"}
              onChange={(event) =>
                onUpdate(block.id, (currentBlock) => ({
                  ...currentBlock,
                  displayMode: readDisplayMode(event.target.value),
                }))
              }
            >
              <option value="auto">Automatic</option>
              <option value="buttons">Buttons</option>
              <option value="listbox">List</option>
            </select>
          </div>
          <div className="catalog-editor-field">
            <label htmlFor={`preset-choice-sort-${block.id}`}>Option Order</label>
            <select
              id={`preset-choice-sort-${block.id}`}
              className="pondinput"
              value={block.optionSort ?? "manual"}
              onChange={(event) =>
                onUpdate(block.id, (currentBlock) => ({
                  ...currentBlock,
                  optionSort: readOptionSort(event.target.value),
                }))
              }
            >
              <option value="manual">Manual</option>
              <option value="alphabetical">Alphabetical</option>
            </select>
          </div>
          {block.multiSelect && (
            <div className="catalog-editor-field">
              <label htmlFor={`preset-choice-separator-${block.id}`}>Separator</label>
              <input
                id={`preset-choice-separator-${block.id}`}
                className="pondinput"
                type="text"
                value={block.separator ?? ""}
                onChange={(event) =>
                  onUpdate(block.id, (currentBlock) => ({
                    ...currentBlock,
                    separator: event.target.value,
                  }))
                }
                placeholder=", "
              />
            </div>
          )}
        </div>
        <ChoiceVisibilityEditor
          block={block}
          choiceDraft={choiceDraft}
          onSetVisibilityController={onSetVisibilityController}
          onSetVisibilityValue={onSetVisibilityValue}
        />
      </details>
    </div>
  );
}

export function PromptPresetChoiceEditor({ draft, onDraftChange }: PromptPresetChoiceEditorProps) {
  const choiceDraft = currentChoiceDraft(draft);
  const issues = validatePromptPresetChoiceDraft(choiceDraft);

  function applyChoiceDraft(nextChoiceDraft: PromptPresetChoiceDraftState) {
    onDraftChange(mergeChoiceDraft(draft, nextChoiceDraft));
  }

  function updateBlock(
    blockId: string,
    update: (block: PromptPresetChoiceBlock) => PromptPresetChoiceBlock,
  ) {
    applyChoiceDraft(updatePromptPresetChoiceBlock(choiceDraft, blockId, update));
  }

  function updateOption(
    blockId: string,
    optionId: string,
    update: (
      option: PromptPresetChoiceBlock["options"][number],
    ) => PromptPresetChoiceBlock["options"][number],
  ) {
    applyChoiceDraft(updatePromptPresetChoiceOption(choiceDraft, blockId, optionId, update));
  }

  return (
    <section className="catalog-editor-section" aria-labelledby="preset-choices-heading">
      <div className="catalog-section-heading-row">
        <div>
          <h4 id="preset-choices-heading">Choice Definitions</h4>
          <p className="catalog-field-hint">
            Reusable choices become variables in Roleplay prompts and appear in thread settings.
          </p>
        </div>
        <button
          type="button"
          className="catalog-new-btn"
          onClick={() => applyChoiceDraft(addPromptPresetChoiceBlock(choiceDraft))}
        >
          Add Choice
        </button>
      </div>
      <div className="catalog-preset-stack">
        {choiceDraft.choiceBlocks.length === 0 ? (
          <div className="catalog-compact-empty">No choice definitions.</div>
        ) : (
          choiceDraft.choiceBlocks.map((block, blockIndex) => (
            <ChoiceBlockCard
              block={block}
              blockIndex={blockIndex}
              choiceDraft={choiceDraft}
              issues={issues
                .filter((issue) => issue.blockId === block.id)
                .map((issue) => issue.message)}
              key={block.id}
              onAddOption={(blockId) =>
                applyChoiceDraft(addPromptPresetChoiceOption(choiceDraft, blockId))
              }
              onMove={(blockId, direction) =>
                applyChoiceDraft(movePromptPresetChoiceBlock(choiceDraft, blockId, direction))
              }
              onMoveOption={(blockId, optionId, direction) =>
                applyChoiceDraft(
                  movePromptPresetChoiceOption(choiceDraft, blockId, optionId, direction),
                )
              }
              onRemove={(blockId) =>
                applyChoiceDraft(removePromptPresetChoiceBlock(choiceDraft, blockId))
              }
              onRemoveOption={(blockId, optionId) =>
                applyChoiceDraft(removePromptPresetChoiceOption(choiceDraft, blockId, optionId))
              }
              onRenameVariable={(blockId, variableName) =>
                applyChoiceDraft(
                  renamePromptPresetChoiceVariable(choiceDraft, blockId, variableName),
                )
              }
              onSetDefault={(blockId, optionId, selected) =>
                applyChoiceDraft(
                  setPromptPresetChoiceDefault(choiceDraft, blockId, optionId, selected),
                )
              }
              onSetVisibilityController={(blockId, controllerId) =>
                applyChoiceDraft(
                  setPromptPresetChoiceVisibilityController(choiceDraft, blockId, controllerId),
                )
              }
              onSetVisibilityValue={(blockId, value, selected) =>
                applyChoiceDraft(
                  setPromptPresetChoiceVisibilityValue(choiceDraft, blockId, value, selected),
                )
              }
              onUpdate={updateBlock}
              onUpdateOption={updateOption}
            />
          ))
        )}
      </div>
    </section>
  );
}
