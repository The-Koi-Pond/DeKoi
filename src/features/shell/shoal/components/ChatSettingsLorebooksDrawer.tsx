import type { LorebookRecord } from "../../../../engine/contracts/types/lorebook";
import { ChatSettingsDrawer } from "./ChatSettingsBlocks";
import { ChatSettingsLorebookSelector } from "./ChatSettingsLorebookSelector";
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
      <ChatSettingsLorebookSelector
        activeMessengerThread={activeMessengerThread}
        lorebooks={lorebooks}
        missingLorebookCount={missingLorebookCount}
        selectedLorebookIds={selectedLorebookIds}
        onClearMissingLorebooks={onClearMissingLorebooks}
        onCreateLorebook={onCreateLorebook}
        onToggleLorebook={onToggleLorebook}
      />
    </ChatSettingsDrawer>
  );
}
