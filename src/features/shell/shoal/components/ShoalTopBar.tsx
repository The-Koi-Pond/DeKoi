import { MESSENGER, ROLEPLAY } from "../../../../engine/contracts/constants/surfaces";

interface ShoalTopBarProps {
  chatSettingsOpen: boolean;
  nav: {
    selectedSurface: string;
  };
  onOpenChatSettings: () => void;
  onToggleShoal: () => void;
  shoalClosed: boolean;
}

export function ShoalTopBar({
  chatSettingsOpen,
  nav,
  onOpenChatSettings,
  onToggleShoal,
  shoalClosed,
}: ShoalTopBarProps) {
  const chatSettingsLabel =
    nav.selectedSurface === ROLEPLAY
      ? "Roleplay Settings"
      : nav.selectedSurface === MESSENGER
        ? "Messenger Settings"
        : "Chat Settings";

  return (
    <div className="shoal-topbar">
      <button
        type="button"
        className="shoal-toggle"
        aria-label={shoalClosed ? "Open The Shoal" : "Collapse The Shoal"}
        aria-expanded={!shoalClosed}
        title={shoalClosed ? "Open The Shoal" : "Collapse The Shoal"}
        onClick={onToggleShoal}
      >
        {shoalClosed ? "›" : "‹"}
      </button>
      <span>The Shoal</span>
      <button
        type="button"
        className={`shoal-settings-button${chatSettingsOpen ? " on" : ""}`}
        title={chatSettingsLabel}
        aria-label={chatSettingsLabel}
        aria-pressed={chatSettingsOpen}
        onClick={onOpenChatSettings}
      >
        <span aria-hidden="true">⚙</span>
        <span>{chatSettingsLabel}</span>
      </button>
    </div>
  );
}
