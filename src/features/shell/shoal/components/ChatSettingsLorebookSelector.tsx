import type { LorebookRecord } from "../../../../engine/contracts/types/lorebook";
import { ChatSettingsNotice } from "./ChatSettingsBlocks";

interface ChatSettingsLorebookSelectorProps {
  activeMessengerThread: boolean;
  lorebooks: LorebookRecord[];
  missingLorebookCount: number;
  selectedLorebookIds: string[];
  surfaceLabel?: string;
  onClearMissingLorebooks: () => void;
  onCreateLorebook: () => void;
  onToggleLorebook: (lorebookId: string) => void;
}

export function ChatSettingsLorebookSelector({
  activeMessengerThread,
  lorebooks,
  missingLorebookCount,
  selectedLorebookIds,
  surfaceLabel = "Messenger",
  onClearMissingLorebooks,
  onCreateLorebook,
  onToggleLorebook,
}: ChatSettingsLorebookSelectorProps) {
  return (
    <div className="chat-settings-field">
      <span>Selected lorebooks</span>
      {missingLorebookCount > 0 && (
        <ChatSettingsNotice actionLabel="Clear missing" onAction={onClearMissingLorebooks}>
          {missingLorebookCount} selected lorebook
          {missingLorebookCount === 1 ? " is" : "s are"} no longer saved. Missing lorebooks are
          skipped when {surfaceLabel} builds a reply.
        </ChatSettingsNotice>
      )}
      {lorebooks.length === 0 ? (
        <ChatSettingsNotice actionLabel="Create lorebook" onAction={onCreateLorebook}>
          No lorebooks yet. {surfaceLabel} can start without lore, or you can create one for
          reusable context.
        </ChatSettingsNotice>
      ) : (
        <div className="chat-settings-check-list">
          {lorebooks.map((lorebook) => {
            const selected = selectedLorebookIds.includes(lorebook.id);

            return (
              <label className={`chat-settings-check${selected ? " on" : ""}`} key={lorebook.id}>
                <input
                  type="checkbox"
                  checked={selected}
                  disabled={!activeMessengerThread}
                  onChange={() => onToggleLorebook(lorebook.id)}
                />
                <span>{lorebook.title}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
