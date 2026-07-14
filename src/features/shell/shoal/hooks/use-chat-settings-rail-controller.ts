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
import { getActiveModeBranch } from "../../../../engine/modes/mode-thread/mode-thread-actions";

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
    ? (nav.modeThreads.find(
        (thread): thread is Extract<(typeof nav.modeThreads)[number], { kind: "messenger" }> =>
          thread.kind === "messenger" && thread.id === activeMessengerThreadId,
      ) ?? null)
    : null;
  const activeRoleplayThreadId = nav.view.kind === "roleplay" ? nav.view.threadId : null;
  const activeRoleplayThread = activeRoleplayThreadId
    ? (nav.modeThreads.find(
        (thread): thread is Extract<(typeof nav.modeThreads)[number], { kind: "roleplay" }> =>
          thread.kind === "roleplay" && thread.id === activeRoleplayThreadId,
      ) ?? null)
    : null;
  const activeMessengerSettingsThread = useMemo(
    () =>
      activeMessengerThread
        ? { ...activeMessengerThread, ...getActiveModeBranch(activeMessengerThread) }
        : null,
    [activeMessengerThread],
  );
  const activeRoleplaySettingsThread = useMemo(
    () =>
      activeRoleplayThread
        ? { ...activeRoleplayThread, ...getActiveModeBranch(activeRoleplayThread) }
        : null,
    [activeRoleplayThread],
  );
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
        activeThread: activeMessengerSettingsThread,
        appSettings: nav.appSettings,
        characters: nav.characters,
        lorebooks: nav.lorebooks,
        personas: nav.personas,
        promptPresets: nav.promptPresets,
        providerConnections: nav.providerConnections,
        threadLabel: "Messenger",
      }),
    [
      activeMessengerSettingsThread,
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
        activeThread: activeRoleplaySettingsThread,
        appSettings: nav.appSettings,
        characters: nav.characters,
        lorebooks: nav.lorebooks,
        personas: nav.personas,
        promptPresets: nav.promptPresets,
        providerConnections: nav.providerConnections,
        threadLabel: "Roleplay",
      }),
    [
      activeRoleplaySettingsThread,
      nav.appSettings,
      nav.characters,
      nav.lorebooks,
      nav.personas,
      nav.promptPresets,
      nav.providerConnections,
    ],
  );
  const messengerSettings: ChatSettingsMessengerSettings = {
    activeMessengerThread: activeMessengerSettingsThread,
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
    activeRoleplayThread: activeRoleplaySettingsThread,
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
