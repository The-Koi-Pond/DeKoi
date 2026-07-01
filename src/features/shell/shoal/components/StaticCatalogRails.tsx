import { MediaCatalogRailBody } from "./MediaCatalogRailBody";
import { PresetsCatalogRailBody } from "./PresetsCatalogRailBody";
import {
  StaticCatalogRailShell,
  type StaticCatalogRailProps,
} from "./StaticCatalogRailShell";

export function MediaCatalogRail({
  chatSettingsOpen,
  nav,
  onOpenChatSettings,
  onToggleShoal,
  shoalClosed,
}: StaticCatalogRailProps) {
  return (
    <StaticCatalogRailShell
      ariaLabel="Catalog — media"
      chatSettingsOpen={chatSettingsOpen}
      nav={nav}
      onOpenChatSettings={onOpenChatSettings}
      onToggleShoal={onToggleShoal}
      shoalClosed={shoalClosed}
    >
      <MediaCatalogRailBody />
    </StaticCatalogRailShell>
  );
}

export function PresetsCatalogRail({
  chatSettingsOpen,
  nav,
  onOpenChatSettings,
  onToggleShoal,
  shoalClosed,
}: StaticCatalogRailProps) {
  return (
    <StaticCatalogRailShell
      ariaLabel="Catalog — presets"
      chatSettingsOpen={chatSettingsOpen}
      nav={nav}
      onOpenChatSettings={onOpenChatSettings}
      onToggleShoal={onToggleShoal}
      shoalClosed={shoalClosed}
    >
      <PresetsCatalogRailBody />
    </StaticCatalogRailShell>
  );
}
