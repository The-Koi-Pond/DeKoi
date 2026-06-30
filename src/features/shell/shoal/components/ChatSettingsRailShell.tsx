import type { ReactNode } from "react";
import { ShoalTopBar } from "./ShoalTopBar";
import type { ShoalRailProps } from "../types";

interface ChatSettingsRailShellProps {
  children: ReactNode;
  chatSettingsOpen: boolean;
  nav: ShoalRailProps["nav"];
  settingsLabel: string;
  shoalClosed: boolean;
  onOpenChatSettings: () => void;
  onToggleShoal: () => void;
}

export function ChatSettingsRailShell({
  children,
  chatSettingsOpen,
  nav,
  settingsLabel,
  shoalClosed,
  onOpenChatSettings,
  onToggleShoal,
}: ChatSettingsRailShellProps) {
  return (
    <aside
      className="shoal chat-settings-shoal"
      aria-label={`The Shoal - ${settingsLabel}`}
    >
      <ShoalTopBar
        chatSettingsOpen={chatSettingsOpen}
        nav={nav}
        onOpenChatSettings={onOpenChatSettings}
        onToggleShoal={onToggleShoal}
        shoalClosed={shoalClosed}
      />
      <div className="shoal-body">{children}</div>
    </aside>
  );
}
