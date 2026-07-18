import type { PromptPresetRecord } from "../../../../engine/contracts/types/prompt-presets";
import { ChatSettingsDrawer, ChatSettingsNotice } from "./ChatSettingsBlocks";
import { ChatSettingsDropdown, type ChatSettingsDropdownOption } from "./ChatSettingsDropdown";
import type { ChatSettingsDrawerId } from "../lib/chat-settings-drawers";
import type { ChatSettingsPresetResourceModel } from "../lib/chat-settings-resource-drawer-models";

interface ChatSettingsPresetDrawerProps {
  actionDisabled?: boolean;
  actionLabel?: string;
  fieldLabel?: string;
  model: ChatSettingsPresetResourceModel;
  promptPresets: readonly PromptPresetRecord[];
  secondaryActionDisabled?: boolean;
  secondaryActionLabel?: string;
  surfaceLabel?: string;
  title?: string;
  onClearMissingPreset: () => void;
  onPresetAction?: () => void;
  onPresetChange: (presetId: string) => void;
  onSecondaryAction?: () => void;
  onToggle: (drawerId: ChatSettingsDrawerId) => void;
}

export function ChatSettingsPresetDrawer({
  actionDisabled = false,
  actionLabel = "New",
  fieldLabel = "Prompt preset",
  model,
  promptPresets,
  secondaryActionDisabled = false,
  secondaryActionLabel,
  surfaceLabel = "Messenger",
  title = `${surfaceLabel} Preset`,
  onClearMissingPreset,
  onPresetAction,
  onPresetChange,
  onSecondaryAction,
  onToggle,
}: ChatSettingsPresetDrawerProps) {
  const options: ChatSettingsDropdownOption[] = [
    { label: "No preset", value: "" },
    ...promptPresets.map((preset) => ({ label: preset.name, value: preset.id })),
    ...(model.missingPresetId
      ? [
          {
            disabled: true,
            label: `Missing preset (${model.missingPresetId})`,
            value: model.missingPresetId,
          },
        ]
      : []),
  ];

  return (
    <ChatSettingsDrawer
      drawerId="preset"
      open={model.open}
      summary={model.summary}
      title={title}
      onToggle={onToggle}
    >
      {model.missingPresetId && (
        <ChatSettingsNotice actionLabel="Clear missing preset" onAction={onClearMissingPreset}>
          This thread references a preset that is not in the catalog.
        </ChatSettingsNotice>
      )}
      <div className="chat-settings-field">
        <span id={`chat-settings-${surfaceLabel.toLowerCase()}-preset-label`}>{fieldLabel}</span>
        <div className="chat-settings-prompt-select">
          <ChatSettingsDropdown
            value={model.selectedPresetId ?? ""}
            labelledBy={`chat-settings-${surfaceLabel.toLowerCase()}-preset-label`}
            menuId={`chat-settings-${surfaceLabel.toLowerCase()}-preset-menu`}
            options={options}
            disabled={!model.activeThread}
            onChange={onPresetChange}
          />
          <div className="chat-settings-prompt-actions">
            {onPresetAction && (
              <button
                type="button"
                className="chat-settings-edit-button"
                disabled={actionDisabled}
                onClick={onPresetAction}
              >
                {actionLabel}
              </button>
            )}
            {secondaryActionLabel && onSecondaryAction && (
              <button
                type="button"
                className="chat-settings-edit-button"
                disabled={secondaryActionDisabled}
                onClick={onSecondaryAction}
              >
                {secondaryActionLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </ChatSettingsDrawer>
  );
}
