import type { ReactNode } from "react";
import { ShoalTopBar } from "./ShoalTopBar";
import type { ShoalNav } from "../types";

export interface StaticCatalogRailProps {
  chatSettingsOpen: boolean;
  nav: Pick<ShoalNav, "selectedSurface">;
  onOpenChatSettings: () => void;
  onToggleShoal: () => void;
  shoalClosed: boolean;
}

interface StaticCatalogRailShellProps extends StaticCatalogRailProps {
  ariaLabel: string;
  children: ReactNode;
}

export function StaticCatalogRailShell({
  ariaLabel,
  chatSettingsOpen,
  children,
  nav,
  onOpenChatSettings,
  onToggleShoal,
  shoalClosed,
}: StaticCatalogRailShellProps) {
  return (
    <aside className="shoal catalog-rail" aria-label={ariaLabel}>
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
