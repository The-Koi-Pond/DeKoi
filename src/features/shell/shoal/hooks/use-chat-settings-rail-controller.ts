import { useMemo, useState } from "react";
import { MESSENGER, ROLEPLAY } from "../../../../engine/contracts/constants/surfaces";
import {
  CHAT_SETTINGS_DRAWER_DEFAULTS,
  type ChatSettingsDrawerId,
} from "../lib/chat-settings-drawers";
import type {
  ChatSettingsMessengerActionGroup,
  ChatSettingsMessengerSettings,
} from "../lib/chat-settings-controller-groups";
import { getChatSettingsViewModel } from "../lib/chat-settings-view-model";
import type { ShoalRailProps } from "../types";
import { useChatSettingsMessengerActions } from "./use-chat-settings-messenger-actions";

interface UseChatSettingsRailControllerInput {
  nav: ShoalRailProps["nav"];
}

export function useChatSettingsRailController({
  nav,
}: UseChatSettingsRailControllerInput) {
  const settingsLabel =
    nav.selectedSurface === ROLEPLAY
      ? "Roleplay Settings"
      : nav.selectedSurface === MESSENGER
        ? "Messenger Settings"
        : "Chat Settings";
  const isMessengerSettings = nav.selectedSurface === MESSENGER;
  const activeMessengerThreadId =
    nav.view.kind === "messenger" ? nav.view.threadId : null;
  const activeMessengerThread = activeMessengerThreadId
    ? nav.messengerThreads.find((thread) => thread.id === activeMessengerThreadId) ??
      null
    : null;
  const [openDrawers, setOpenDrawers] = useState(CHAT_SETTINGS_DRAWER_DEFAULTS);
  const [companionSelectorOpen, setCompanionSelectorOpen] = useState(false);
  const {
    identityActions,
    promptActions,
    resourceActions,
  } = useChatSettingsMessengerActions({
    activeMessengerThread,
    characters: nav.characters,
    lorebooks: nav.lorebooks,
    onCompanionSelectorOpenChange: setCompanionSelectorOpen,
    onUpdateMessengerThread: nav.updateMessengerThread,
  });

  function toggleChatSettingsDrawer(drawerId: ChatSettingsDrawerId) {
    setOpenDrawers((current) => ({
      ...current,
      [drawerId]: !current[drawerId],
    }));
  }

  const chatSettingsViewModel = useMemo(
    () =>
      getChatSettingsViewModel({
        activeMessengerThread,
        appSettings: nav.appSettings,
        characters: nav.characters,
        lorebooks: nav.lorebooks,
        personas: nav.personas,
        providerConnections: nav.providerConnections,
      }),
    [
      activeMessengerThread,
      nav.appSettings,
      nav.characters,
      nav.lorebooks,
      nav.personas,
      nav.providerConnections,
    ],
  );
  const messengerSettings: ChatSettingsMessengerSettings = {
    activeMessengerThread,
    activeMessengerThreadId,
    chatSettingsViewModel,
    companionSelectorOpen,
    openDrawers,
  };
  const messengerActions: ChatSettingsMessengerActionGroup = {
    drawers: {
      onToggle: toggleChatSettingsDrawer,
    },
    identity: identityActions,
    prompt: promptActions,
    resources: {
      ...resourceActions,
      onSelectorOpenChange: setCompanionSelectorOpen,
    },
  };

  return {
    isMessengerSettings,
    messengerActions,
    messengerSettings,
    settingsLabel,
  };
}
