import { useMemo, useState } from "react";
import { MESSENGER, ROLEPLAY } from "../../../../engine/contracts/constants/surfaces";
import type { ShoalSortMode } from "../../../../engine/contracts/types/app-settings";
import { sanitizeProviderConnectionRecord } from "../../../../engine/contracts/types/provider-connection";
import { createNewThreadLabels } from "../lib/new-thread-labels";
import { getThreadShoalLists } from "../lib/thread-shoal-lists";
import type { ShoalRailProps } from "../types";

const SHOAL_SORT_ORDER: ShoalSortMode[] = ["freshest", "oldest", "title"];
const SHOAL_SORT_LABELS: Record<ShoalSortMode, string> = {
  freshest: "Freshest first",
  oldest: "Oldest first",
  title: "A-Z",
};

interface UseThreadShoalViewModelInput {
  nav: ShoalRailProps["nav"];
}

export function useThreadShoalViewModel({ nav }: UseThreadShoalViewModelInput) {
  const [query, setQuery] = useState("");
  const sortMode = nav.appSettings.shoalSortMode;
  const nextMessengerThreadNumber = nav.messengerThreads.length + 1;
  const nextRoleplayThreadNumber = nav.roleplayThreads.length + 1;
  const activeSurface = nav.selectedSurface === ROLEPLAY ? ROLEPLAY : MESSENGER;
  const isRoleplaySurface = activeSurface === ROLEPLAY;
  const activeMessengerThreadId = nav.view.kind === "messenger" ? nav.view.threadId : null;
  const activeRoleplayThreadId = nav.view.kind === "roleplay" ? nav.view.threadId : null;
  const characterById = useMemo(
    () => new Map(nav.characters.map((character) => [character.id, character])),
    [nav.characters],
  );
  const newThreadLabels = useMemo(
    () =>
      createNewThreadLabels({
        characterById,
        lorebooks: nav.lorebooks,
        nextMessengerThreadNumber,
        nextRoleplayThreadNumber,
      }),
    [characterById, nav.lorebooks, nextMessengerThreadNumber, nextRoleplayThreadNumber],
  );
  const sanitizedProviderConnections = useMemo(
    () => nav.providerConnections.map((connection) => sanitizeProviderConnectionRecord(connection)),
    [nav.providerConnections],
  );
  const defaultMessengerConnectionId =
    sanitizedProviderConnections.find(
      (connection) => connection.id === nav.appSettings.activeMessengerConnectionId,
    )?.id ??
    sanitizedProviderConnections[0]?.id ??
    "";
  const threadShoalLists = useMemo(
    () =>
      getThreadShoalLists({
        characterById,
        messengerThreads: nav.messengerThreads,
        query,
        roleplayThreads: nav.roleplayThreads,
        sortMode,
      }),
    [characterById, nav.messengerThreads, nav.roleplayThreads, query, sortMode],
  );

  function cycleSortMode() {
    const currentIndex = SHOAL_SORT_ORDER.indexOf(sortMode);
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % SHOAL_SORT_ORDER.length;
    nav.setShoalSortMode(SHOAL_SORT_ORDER[nextIndex]);
  }

  const activeSurfaceLabel = isRoleplaySurface ? "Roleplay" : "Messenger";
  const searchPlaceholder = isRoleplaySurface
    ? "Find a scene by name or text..."
    : "Find a character by name or message...";

  return {
    activeMessengerThreadId,
    activeRoleplayThreadId,
    activeSurfaceLabel,
    characterById,
    defaultMessengerConnectionId,
    isRoleplaySurface,
    newThreadLabels,
    query,
    sanitizedProviderConnections,
    searchPlaceholder,
    sortLabel: SHOAL_SORT_LABELS[sortMode],
    threadShoalLists,
    cycleSortMode,
    setQuery,
  };
}
