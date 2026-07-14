import { useMemo, useState } from "react";
import { MESSENGER, ROLEPLAY } from "../../../../engine/contracts/constants/surfaces";
import {
  CHAT_SETTINGS_DRAWER_DEFAULTS,
  type ChatSettingsDrawerId,
} from "../lib/chat-settings-drawers";
import type {
  ChatSettingsMessengerActionGroup,
  ChatSettingsMessengerSettings,
  ChatSettingsRoleplayActionGroup,
  ChatSettingsRoleplaySettings,
} from "../lib/chat-settings-controller-groups";
import { getChatSettingsViewModel } from "../lib/chat-settings-view-model";
import type { ShoalRailProps } from "../types";
import { useChatSettingsMessengerActions } from "./use-chat-settings-messenger-actions";
import { useChatSettingsRoleplayActions } from "./use-chat-settings-roleplay-actions";

interface UseChatSettingsRailControllerInput {
  nav: ShoalRailProps["nav"];
}

export function useChatSettingsRailController({ nav }: UseChatSettingsRailControllerInput) {
  const settingsLabel =
    nav.selectedSurface === ROLEPLAY
      ? "Roleplay Settings"
      : nav.selectedSurface === MESSENGER
        ? "Messenger Settings"
        : "Chat Settings";
  const isMessengerSettings = nav.selectedSurface === MESSENGER;
  const isRoleplaySettings = nav.selectedSurface === ROLEPLAY;
  const activeMessengerThreadId = nav.view.kind === "messenger" ? nav.view.threadId : null;
  const activeMessengerThread = activeMessengerThreadId
    ? (nav.messengerThreads.find((thread) => thread.id === activeMessengerThreadId) ?? null)
    : null;
  const activeRoleplayThreadId = nav.view.kind === "roleplay" ? nav.view.threadId : null;
  const activeRoleplayThread = activeRoleplayThreadId
    ? (nav.roleplayThreads.find((thread) => thread.id === activeRoleplayThreadId) ?? null)
    : null;
  const [openDrawers, setOpenDrawers] = useState(CHAT_SETTINGS_DRAWER_DEFAULTS);
  const [companionSelectorOpen, setCompanionSelectorOpen] = useState(false);
  const { identityActions, presetActions, resourceActions } = useChatSettingsMessengerActions({
    activeMessengerThread,
    characters: nav.characters,
    lorebooks: nav.lorebooks,
    onCompanionSelectorOpenChange: setCompanionSelectorOpen,
    onUpdateMessengerThreadById: nav.updateMessengerThreadById,
  });
  const {
    identityActions: roleplayIdentityActions,
    presetActions: roleplayPresetActions,
    resourceActions: roleplayResourceActions,
  } = useChatSettingsRoleplayActions({
    activeRoleplayThread,
    characters: nav.characters,
    lorebooks: nav.lorebooks,
    onCompanionSelectorOpenChange: setCompanionSelectorOpen,
    onUpdateRoleplayThreadById: nav.updateRoleplayThreadById,
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
        activeThread: activeMessengerThread,
        appSettings: nav.appSettings,
        characters: nav.characters,
        lorebooks: nav.lorebooks,
        personas: nav.personas,
        promptPresets: nav.promptPresets,
        providerConnections: nav.providerConnections,
        threadLabel: "Messenger",
      }),
    [
      activeMessengerThread,
      nav.appSettings,
      nav.characters,
      nav.lorebooks,
      nav.personas,
      nav.promptPresets,
      nav.providerConnections,
    ],
  );
  const roleplayChatSettingsViewModel = useMemo(
    () =>
      getChatSettingsViewModel({
        activeThread: activeRoleplayThread,
        appSettings: nav.appSettings,
        characters: nav.characters,
        lorebooks: nav.lorebooks,
        personas: nav.personas,
        promptPresets: nav.promptPresets,
        providerConnections: nav.providerConnections,
        threadLabel: "Roleplay",
      }),
    [
      activeRoleplayThread,
      nav.appSettings,
      nav.characters,
      nav.lorebooks,
      nav.personas,
      nav.promptPresets,
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
    preset: presetActions,
    resources: {
      ...resourceActions,
      onSelectorOpenChange: setCompanionSelectorOpen,
    },
  };
  const roleplaySettings: ChatSettingsRoleplaySettings = {
    activeRoleplayThread,
    activeRoleplayThreadId,
    chatSettingsViewModel: roleplayChatSettingsViewModel,
    companionSelectorOpen,
    openDrawers,
  };
  const roleplayActions: ChatSettingsRoleplayActionGroup = {
    drawers: {
      onToggle: toggleChatSettingsDrawer,
    },
    identity: roleplayIdentityActions,
    preset: roleplayPresetActions,
    resources: {
      ...roleplayResourceActions,
      onSelectorOpenChange: setCompanionSelectorOpen,
    },
  };

  return {
    isMessengerSettings,
    isRoleplaySettings,
    messengerActions,
    messengerSettings,
    roleplayActions,
    roleplaySettings,
    settingsLabel,
  };
}
