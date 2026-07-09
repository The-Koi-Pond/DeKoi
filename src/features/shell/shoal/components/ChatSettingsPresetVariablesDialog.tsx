import { createPortal } from "react-dom";
import type {
  PromptPresetChoiceSelection,
  PromptPresetChoiceSelections,
  PromptPresetRecord,
} from "../../../../engine/contracts/types/prompt-presets";
import {
  resolvePromptPresetChoiceControls,
  type PromptPresetChoiceControl,
} from "../../../../engine/prompt-presets/prompt-preset-actions";
import { ChatSettingsDropdown, type ChatSettingsDropdownOption } from "./ChatSettingsDropdown";

const DEFAULT_CHOICE_OPTION_VALUE = "__dekoi-preset-default__";

interface ChatSettingsPresetVariablesDialogProps {
  open: boolean;
  preset: PromptPresetRecord | null;
  presetChoiceSelections: PromptPresetChoiceSelections;
  onClose: () => void;
  onPresetChoiceChange: (variableName: string, selection: PromptPresetChoiceSelection) => void;
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
            const defaultOptionValue = defaultChoiceOptionValue(control);
            const selectedOptionValue = control.selectedOptionIds[0] ?? defaultOptionValue;
            return (
              <div className="preset-variables-field" key={control.id}>
                <span id={fieldId}>{control.label}</span>
                {control.multiSelect ? (
                  <>
                    <div className="preset-variables-default-row">
                      <small>{control.defaultLabel}</small>
                      <button
                        type="button"
                        onClick={() => onPresetChoiceChange(control.variableName, [])}
                      >
                        Use default
                      </button>
                    </div>
                    <div
                      className="preset-variables-check-list"
                      role="group"
                      aria-labelledby={fieldId}
                    >
                      {control.options.map((option) => (
                        <label className="preset-variables-check" key={option.id}>
                          <input
                            type="checkbox"
                            checked={control.selectedOptionIds.includes(option.id)}
                            onChange={() =>
                              onPresetChoiceChange(
                                control.variableName,
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
                ) : (
                  <ChatSettingsDropdown
                    value={selectedOptionValue}
                    labelledBy={fieldId}
                    menuId={`${fieldId}-menu`}
                    options={choiceOptions(control, defaultOptionValue)}
                    onChange={(value) =>
                      onPresetChoiceChange(
                        control.variableName,
                        value === defaultOptionValue
                          ? ""
                          : (control.options.find((option) => option.id === value)?.selection ??
                              ""),
                      )
                    }
                  />
                )}
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
