import { useEffect, useState } from "react";
import type { ShoalNav, ThreadReleaseRequest } from "../types";

interface UseThreadReleaseActionsInput {
  confirmRelease: boolean;
  onDeleteMessengerThread: ShoalNav["deleteMessengerThread"];
  onDeleteRoleplayThread: ShoalNav["deleteRoleplayThread"];
  onRenameRoleplayThread: ShoalNav["renameRoleplayThread"];
}

export function useThreadReleaseActions({
  confirmRelease,
  onDeleteMessengerThread,
  onDeleteRoleplayThread,
  onRenameRoleplayThread,
}: UseThreadReleaseActionsInput) {
  const [releaseRequest, setReleaseRequest] =
    useState<ThreadReleaseRequest | null>(null);

  useEffect(() => {
    if (!releaseRequest) return;

    function handleDocumentKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") setReleaseRequest(null);
    }

    document.addEventListener("keydown", handleDocumentKeyDown);
    return () => document.removeEventListener("keydown", handleDocumentKeyDown);
  }, [releaseRequest]);

  function handleRenameRoleplay(threadId: string, currentTitle: string) {
    const nextTitle = window.prompt("Rename Roleplay thread", currentTitle);
    if (nextTitle === null) return;
    onRenameRoleplayThread(threadId, nextTitle);
  }

  function handleDeleteMessenger(threadId: string, title: string) {
    if (!confirmRelease) {
      onDeleteMessengerThread(threadId);
      return;
    }

    setReleaseRequest({ id: threadId, kind: "messenger", title });
  }

  function handleDeleteRoleplay(threadId: string, title: string) {
    if (!confirmRelease) {
      onDeleteRoleplayThread(threadId);
      return;
    }

    setReleaseRequest({ id: threadId, kind: "roleplay", title });
  }

  function confirmReleaseThread() {
    if (!releaseRequest) return;

    if (releaseRequest.kind === "messenger") {
      onDeleteMessengerThread(releaseRequest.id);
    } else {
      onDeleteRoleplayThread(releaseRequest.id);
    }

    setReleaseRequest(null);
  }

  return {
    clearReleaseRequest: () => setReleaseRequest(null),
    confirmReleaseThread,
    handleDeleteMessenger,
    handleDeleteRoleplay,
    handleRenameRoleplay,
    releaseRequest,
  };
}
