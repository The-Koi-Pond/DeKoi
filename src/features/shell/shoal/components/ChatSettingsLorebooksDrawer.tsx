import type { LorebookRecord } from "../../../../engine/contracts/types/lorebook";
import { ChatSettingsDrawer, ChatSettingsNotice } from "./ChatSettingsBlocks";
import type { ChatSettingsDrawerId } from "../lib/chat-settings-drawers";

interface ChatSettingsLorebooksDrawerProps {
  activeMessengerThread: boolean;
  lorebooks: LorebookRecord[];
  missingLorebookCount: number;
  open: boolean;
  selectedLorebookIds: string[];
  summary: string;
  onClearMissingLorebooks: () => void;
  onCreateLorebook: () => void;
  onToggle: (drawerId: ChatSettingsDrawerId) => void;
  onToggleLorebook: (lorebookId: string) => void;
}

export function ChatSettingsLorebooksDrawer({
  activeMessengerThread,
  lorebooks,
  missingLorebookCount,
  open,
  selectedLorebookIds,
  summary,
  onClearMissingLorebooks,
  onCreateLorebook,
  onToggle,
  onToggleLorebook,
}: ChatSettingsLorebooksDrawerProps) {
  return (
    <ChatSettingsDrawer
      drawerId="lorebooks"
      open={open}
      summary={summary}
      title="Lorebooks"
      onToggle={onToggle}
    >
      <div className="chat-settings-field">
        <span>Selected lorebooks</span>
        {missingLorebookCount > 0 && (
          <ChatSettingsNotice
            actionLabel="Clear missing"
            onAction={onClearMissingLorebooks}
          >
            {missingLorebookCount} selected lorebook
            {missingLorebookCount === 1 ? " is" : "s are"} no longer saved.
            Missing lorebooks are skipped when Messenger builds a reply.
          </ChatSettingsNotice>
        )}
        {lorebooks.length === 0 ? (
          <ChatSettingsNotice
            actionLabel="Create lorebook"
            onAction={onCreateLorebook}
          >
            No lorebooks yet. Messenger can start without lore, or you can create
            one for reusable context.
          </ChatSettingsNotice>
        ) : (
          <div className="chat-settings-check-list">
            {lorebooks.map((lorebook) => {
              const selected = selectedLorebookIds.includes(lorebook.id);

              return (
                <label
                  className={`chat-settings-check${selected ? " on" : ""}`}
                  key={lorebook.id}
                >
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
    </ChatSettingsDrawer>
  );
}
