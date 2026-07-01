import { ChatSettingsLorebooksDrawer } from "./ChatSettingsLorebooksDrawer";
import type { ChatSettingsDrawerId } from "../lib/chat-settings-drawers";
import type { ChatSettingsLorebookResourceModel } from "../lib/chat-settings-resource-drawer-models";
import type { ShoalRailProps } from "../types";

interface ChatSettingsLorebookResourceDrawerProps {
  activeMessengerThread: boolean;
  lorebooks: ShoalRailProps["nav"]["lorebooks"];
  model: ChatSettingsLorebookResourceModel;
  onClearMissingLorebooks: () => void;
  onCreateLorebook: () => void;
  onToggle: (drawerId: ChatSettingsDrawerId) => void;
  onToggleLorebook: (lorebookId: string) => void;
}

export function ChatSettingsLorebookResourceDrawer({
  activeMessengerThread,
  lorebooks,
  model,
  onClearMissingLorebooks,
  onCreateLorebook,
  onToggle,
  onToggleLorebook,
}: ChatSettingsLorebookResourceDrawerProps) {
  return (
    <ChatSettingsLorebooksDrawer
      activeMessengerThread={activeMessengerThread}
      lorebooks={lorebooks}
      missingLorebookCount={model.missingLorebookCount}
      open={model.open}
      selectedLorebookIds={model.selectedLorebookIds}
      summary={model.summary}
      onClearMissingLorebooks={onClearMissingLorebooks}
      onCreateLorebook={onCreateLorebook}
      onToggle={onToggle}
      onToggleLorebook={onToggleLorebook}
    />
  );
}
