import { ChatSettingsRail } from "./ChatSettingsRail";
import { ConnectionsCatalogRail } from "./ConnectionsCatalogRail";
import { LorebookCatalogRail } from "./LorebookCatalogRail";
import { PeopleCatalogRail } from "./PeopleCatalogRail";
import { MediaCatalogRail, PresetsCatalogRail } from "./StaticCatalogRails";
import { ThreadShoal } from "./ThreadShoal";
import type { ShoalProps, ShoalRailProps } from "../types";

export function ShoalRailRouter({ nav, onToggleShoal, shoalClosed }: ShoalProps) {
  const chatSettingsOpen = nav.sideRailView === "chat-settings";

  const railProps: ShoalRailProps = {
    chatSettingsOpen,
    nav,
    onCloseChatSettings: () => nav.setSideRailView("shoal"),
    onOpenChatSettings: () => nav.setSideRailView("chat-settings"),
    onToggleShoal,
    shoalClosed,
  };

  if (chatSettingsOpen) {
    return <ChatSettingsRail {...railProps} />;
  }

  if (nav.sideRailView === "lorebooks") {
    return <LorebookCatalogRail {...railProps} />;
  }
  if (nav.sideRailView === "people") {
    return <PeopleCatalogRail {...railProps} />;
  }
  if (nav.sideRailView === "media") {
    return <MediaCatalogRail {...railProps} />;
  }
  if (nav.sideRailView === "presets") {
    return <PresetsCatalogRail {...railProps} />;
  }
  if (nav.sideRailView === "connections") {
    return <ConnectionsCatalogRail {...railProps} />;
  }

  return <ThreadShoal {...railProps} />;
}
