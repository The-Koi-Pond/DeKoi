import { createPortal } from "react-dom";
import type {
  PromptPresetRecord,
  PromptPresetThreadChoiceSelection,
  PromptPresetThreadChoiceSelections,
} from "../../../../engine/contracts/types/prompt-presets";
import {
  resolvePromptPresetChoiceControls,
  updatePromptPresetChoiceSelections,
  type PromptPresetChoiceControl,
} from "../../../../engine/prompt-presets/prompt-preset-actions";
import { reconcileSelectedOptionIds } from "../lib/preset-choice-selection-order";
import { ChatSettingsDropdown, type ChatSettingsDropdownOption } from "./ChatSettingsDropdown";

const DEFAULT_CHOICE_OPTION_VALUE = "__dekoi-preset-default__";

interface ChatSettingsPresetVariablesDialogProps {
  open: boolean;
  preset: PromptPresetRecord | null;
  presetChoiceSelections: PromptPresetThreadChoiceSelections;
  onClose: () => void;
  onPresetChoiceChange: (selections: PromptPresetThreadChoiceSelections) => void;
}

function defaultChoiceOptionValue(control: PromptPresetChoiceControl) {
  let value = DEFAULT_CHOICE_OPTION_VALUE;
  while (control.options.some((option) => option.id === value)) {
    value = `${value}_`;
  }
  return value;
}

function choiceOptions(
  control: PromptPresetChoiceControl,
  defaultOptionValue: string,
): ChatSettingsDropdownOption[] {
  return [
    { label: control.defaultLabel, value: defaultOptionValue },
    ...control.options.map((option) => ({
      label: option.label,
      value: option.id,
    })),
  ];
}

function dialogFieldId(preset: PromptPresetRecord, control: PromptPresetChoiceControl) {
  return `preset-variable-${preset.id}-${control.id}`
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-");
}

function toggleSelectedOptionId(optionIds: string[], optionId: string) {
  return optionIds.includes(optionId)
    ? optionIds.filter((currentOptionId) => currentOptionId !== optionId)
    : [...optionIds, optionId];
}

function selectionsFromOptionIds(control: PromptPresetChoiceControl, optionIds: string[]) {
  const selectionByOptionId = new Map(
    control.options.map((option) => [option.id, option.selection] as const),
  );
  return optionIds.flatMap((optionId) => selectionByOptionId.get(optionId) ?? []);
}

type PresetChoiceChangeHandler = (
  blockId: string,
  selection: PromptPresetThreadChoiceSelection | null,
) => void;

interface PresetVariableControlProps {
  control: PromptPresetChoiceControl;
  fieldId: string;
  onPresetChoiceChange: PresetChoiceChangeHandler;
}

function PresetVariableDefaultRow({
  control,
  onPresetChoiceChange,
}: Pick<PresetVariableControlProps, "control" | "onPresetChoiceChange">) {
  return (
    <div className="preset-variables-default-row">
      <small>{control.defaultLabel}</small>
      <button type="button" onClick={() => onPresetChoiceChange(control.id, null)}>
        Use default
      </button>
    </div>
  );
}

function PresetVariableButtons({
  control,
  fieldId,
  onPresetChoiceChange,
}: PresetVariableControlProps) {
  return (
    <>
      <PresetVariableDefaultRow control={control} onPresetChoiceChange={onPresetChoiceChange} />
      <div className="preset-variables-button-list" role="group" aria-labelledby={fieldId}>
        {control.options.map((option) => {
          const selected = control.selectedOptionIds.includes(option.id);
          return (
            <button
              type="button"
              className={selected ? "selected" : undefined}
              aria-pressed={selected}
              key={option.id}
              onClick={() =>
                onPresetChoiceChange(
                  control.id,
                  control.multiSelect
                    ? selectionsFromOptionIds(
                        control,
                        toggleSelectedOptionId(control.selectedOptionIds, option.id),
                      )
                    : option.selection,
                )
              }
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </>
  );
}

function PresetVariableMultiSelectListbox({
  control,
  fieldId,
  onPresetChoiceChange,
}: PresetVariableControlProps) {
  return (
    <>
      <PresetVariableDefaultRow control={control} onPresetChoiceChange={onPresetChoiceChange} />
      <select
        multiple
        aria-labelledby={fieldId}
        className="pondinput preset-variables-listbox"
        value={control.selectedOptionIds}
        onChange={(event) =>
          onPresetChoiceChange(
            control.id,
            selectionsFromOptionIds(
              control,
              reconcileSelectedOptionIds(
                control.selectedOptionIds,
                [...event.target.selectedOptions].map((option) => option.value),
              ),
            ),
          )
        }
      >
        {control.options.map((option) => (
          <option value={option.id} key={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </>
  );
}

function PresetVariableCheckboxes({
  control,
  fieldId,
  onPresetChoiceChange,
}: PresetVariableControlProps) {
  return (
    <>
      <PresetVariableDefaultRow control={control} onPresetChoiceChange={onPresetChoiceChange} />
      <div className="preset-variables-check-list" role="group" aria-labelledby={fieldId}>
        {control.options.map((option) => (
          <label className="preset-variables-check" key={option.id}>
            <input
              type="checkbox"
              checked={control.selectedOptionIds.includes(option.id)}
              onChange={() =>
                onPresetChoiceChange(
                  control.id,
                  selectionsFromOptionIds(
                    control,
                    toggleSelectedOptionId(control.selectedOptionIds, option.id),
                  ),
                )
              }
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </>
  );
}

function PresetVariableDropdown({
  control,
  fieldId,
  onPresetChoiceChange,
}: PresetVariableControlProps) {
  const defaultOptionValue = defaultChoiceOptionValue(control);
  const selectedOptionValue = control.selectedOptionIds[0] ?? defaultOptionValue;

  return (
    <ChatSettingsDropdown
      value={selectedOptionValue}
      labelledBy={fieldId}
      menuId={`${fieldId}-menu`}
      options={choiceOptions(control, defaultOptionValue)}
      onChange={(value) =>
        onPresetChoiceChange(
          control.id,
          value === defaultOptionValue
            ? null
            : (control.options.find((option) => option.id === value)?.selection ?? null),
        )
      }
    />
  );
}

function PresetVariableControl(props: PresetVariableControlProps) {
  const { control } = props;
  if (control.displayMode === "buttons") return <PresetVariableButtons {...props} />;
  if (control.multiSelect && control.displayMode === "listbox") {
    return <PresetVariableMultiSelectListbox {...props} />;
  }
  if (control.multiSelect) return <PresetVariableCheckboxes {...props} />;
  return <PresetVariableDropdown {...props} />;
}

export function ChatSettingsPresetVariablesDialog({
  open,
  preset,
  presetChoiceSelections,
  onClose,
  onPresetChoiceChange,
}: ChatSettingsPresetVariablesDialogProps) {
  if (!open || !preset) return null;

  const choiceControls = resolvePromptPresetChoiceControls({
    preset,
    selections: presetChoiceSelections,
  });
  const handlePresetChoiceChange: PresetChoiceChangeHandler = (blockId, selection) => {
    onPresetChoiceChange(
      updatePromptPresetChoiceSelections(preset, presetChoiceSelections, blockId, selection),
    );
  };

  const dialog = (
    <div className="prompt-editor-backdrop" role="presentation" onClick={onClose}>
      <section
        className="prompt-editor-popover preset-variables-popover"
        role="dialog"
        aria-modal="true"
        aria-labelledby="preset-variables-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="prompt-editor-head">
          <b id="preset-variables-title">Preset Variables</b>
          <button type="button" aria-label="Close preset variables" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="preset-variables-list">
          {choiceControls.length === 0 && <p className="preset-variables-empty">No variables</p>}
          {choiceControls.map((control) => {
            const fieldId = dialogFieldId(preset, control);
            return (
              <div className="preset-variables-field" key={control.id}>
                <span id={fieldId}>{control.label}</span>
                <PresetVariableControl
                  control={control}
                  fieldId={fieldId}
                  onPresetChoiceChange={handlePresetChoiceChange}
                />
              </div>
            );
          })}
        </div>
        <div className="prompt-editor-actions">
          <button type="button" onClick={onClose}>
            Done
          </button>
        </div>
      </section>
    </div>
  );

  if (typeof document === "undefined") return dialog;

  return createPortal(dialog, document.body);
}
