import { ChatSettingsLorebooksDrawer } from "./ChatSettingsLorebooksDrawer";
import type { ChatSettingsDrawerId } from "../lib/chat-settings-drawers";
import type { ChatSettingsLorebookResourceModel } from "../lib/chat-settings-resource-drawer-models";
import type { ShoalRailProps } from "../types";

interface ChatSettingsLorebookResourceDrawerProps {
  lorebooks: ShoalRailProps["nav"]["lorebooks"];
  model: ChatSettingsLorebookResourceModel;
  surfaceLabel?: string;
  onClearMissingLorebooks: () => void;
  onCreateLorebook: () => void;
  onToggle: (drawerId: ChatSettingsDrawerId) => void;
  onToggleLorebook: (lorebookId: string) => void;
}

export function ChatSettingsLorebookResourceDrawer({
  lorebooks,
  model,
  surfaceLabel = "Messenger",
  onClearMissingLorebooks,
  onCreateLorebook,
  onToggle,
  onToggleLorebook,
}: ChatSettingsLorebookResourceDrawerProps) {
  return (
    <ChatSettingsLorebooksDrawer
      activeMessengerThread={model.activeMessengerThread}
      lorebooks={lorebooks}
      missingLorebookCount={model.missingLorebookCount}
      open={model.open}
      selectedLorebookIds={model.selectedLorebookIds}
      summary={model.summary}
      surfaceLabel={surfaceLabel}
      onClearMissingLorebooks={onClearMissingLorebooks}
      onCreateLorebook={onCreateLorebook}
      onToggle={onToggle}
      onToggleLorebook={onToggleLorebook}
    />
  );
}
