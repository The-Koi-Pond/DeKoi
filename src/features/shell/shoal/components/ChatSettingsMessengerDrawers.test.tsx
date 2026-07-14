import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_APP_SETTINGS } from "../../../../engine/contracts/types/app-settings";
import { createMessengerThread } from "../../../../engine/modes/messenger/messenger-actions";
import { getActiveModeBranch } from "../../../../engine/modes/mode-thread/mode-thread-actions";
import { getChatSettingsViewModel } from "../lib/chat-settings-view-model";
import type { ChatSettingsMessengerActionGroup } from "../lib/chat-settings-controller-groups";
import { ChatSettingsMessengerDrawers } from "./ChatSettingsMessengerDrawers";

const noop = vi.fn();

function renderMessengerSettings() {
  const activeThread = createMessengerThread({
    activePersonaId: null,
    characterIds: [],
    id: "thread-1",
    branchId: "thread-1-branch",
    now: "2026-01-01T00:00:00.000Z",
    title: "Messenger thread",
  });
  const activeThreadRecord = { ...activeThread, ...getActiveModeBranch(activeThread) };
  const actions: ChatSettingsMessengerActionGroup = {
    drawers: { onToggle: noop },
    identity: {
      onConnectionChange: noop,
      onPersonaChange: noop,
      onResolveMissingConnection: noop,
    },
    preset: {
      onClearMissingPreset: noop,
      onPresetChoiceChange: noop,
      onPresetChange: noop,
    },
    resources: {
      clearMissingCompanions: noop,
      clearMissingLorebooks: noop,
      onSelectorOpenChange: noop,
      onToggleCompanion: noop,
      onToggleLorebook: noop,
    },
  };

  return renderToStaticMarkup(
    <ChatSettingsMessengerDrawers
      actions={actions}
      catalog={{ characters: [], lorebooks: [], personas: [], promptPresets: [] }}
      navigation={{
        onCreateCompanion: noop,
        onCreateConnection: noop,
        onCreateLorebook: noop,
        onCreateMessengerThread: noop,
      }}
      settings={{
        activeMessengerThread: activeThreadRecord,
        activeMessengerThreadId: activeThread.id,
        chatSettingsViewModel: getChatSettingsViewModel({
          appSettings: DEFAULT_APP_SETTINGS,
          activeThread: activeThreadRecord,
          characters: [],
          lorebooks: [],
          personas: [],
          promptPresets: [],
          providerConnections: [],
        }),
        companionSelectorOpen: false,
        openDrawers: {
          connection: false,
          persona: false,
          companions: false,
          preset: true,
          lorebooks: false,
          advanced: false,
        },
      }}
    />,
  );
}

describe("ChatSettingsMessengerDrawers", () => {
  it("keeps preset and Variables controls without app-wide Advanced Parameters", () => {
    const markup = renderMessengerSettings();

    expect(markup).toContain("Prompt Preset");
    expect(markup).toContain(">Variables</button>");
    expect(markup).not.toContain("Advanced Parameters");
  });
});
