import { MediaCatalogRailBody } from "./MediaCatalogRailBody";
import { PresetsCatalogRailBody } from "./PresetsCatalogRailBody";
import { StaticCatalogRailShell, type StaticCatalogRailProps } from "./StaticCatalogRailShell";
import type { ShoalNav } from "../types";

type PresetsCatalogRailProps = Omit<StaticCatalogRailProps, "nav"> & {
  nav: Pick<
    ShoalNav,
    | "exportPromptPresetFile"
    | "importPromptPresetFile"
    | "openPromptPresetFile"
    | "promptPresetFileHost"
    | "promptPresetFileStatus"
    | "promptPresets"
    | "selectedSurface"
    | "setPromptPresetFileStatus"
    | "setView"
    | "view"
  >;
};

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
}: PresetsCatalogRailProps) {
  return (
    <StaticCatalogRailShell
      ariaLabel="Catalog — presets"
      chatSettingsOpen={chatSettingsOpen}
      nav={nav}
      onOpenChatSettings={onOpenChatSettings}
      onToggleShoal={onToggleShoal}
      shoalClosed={shoalClosed}
    >
      <PresetsCatalogRailBody nav={nav} originActive={!shoalClosed} />
    </StaticCatalogRailShell>
  );
}
