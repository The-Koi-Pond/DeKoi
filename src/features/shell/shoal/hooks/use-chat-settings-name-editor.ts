import { useState } from "react";
import type { MessengerThread } from "../../../../engine/contracts/types/messenger";

interface UseChatSettingsNameEditorInput {
  activeMessengerThread: MessengerThread | null;
  activeMessengerThreadId: string | null;
  onRenameMessengerThread: (threadId: string, title: string) => void;
}

export function useChatSettingsNameEditor({
  activeMessengerThread,
  activeMessengerThreadId,
  onRenameMessengerThread,
}: UseChatSettingsNameEditorInput) {
  const activeMessengerThreadTitle = activeMessengerThread?.title ?? "";
  const [chatNameEditor, setChatNameEditor] = useState<{
    editing: boolean;
    threadId: string | null;
    value: string;
  }>({
    editing: false,
    threadId: activeMessengerThread?.id ?? null,
    value: activeMessengerThread?.title ?? "",
  });
  const activeChatName = activeMessengerThread?.title.trim() || "Untitled chat";
  const activeChatNameEditor =
    chatNameEditor.threadId === activeMessengerThreadId
      ? chatNameEditor
      : {
          editing: false,
          threadId: activeMessengerThreadId,
          value: activeMessengerThreadTitle,
        };

  function startChatNameEdit() {
    if (!activeMessengerThread) return;
    setChatNameEditor({
      editing: true,
      threadId: activeMessengerThread.id,
      value: activeMessengerThread.title,
    });
  }

  function saveChatName() {
    if (
      !activeMessengerThread ||
      activeChatNameEditor.threadId !== activeMessengerThreadId ||
      activeChatNameEditor.threadId !== activeMessengerThread.id
    ) {
      cancelChatNameEdit();
      return;
    }
    const nextTitle = activeChatNameEditor.value.trim();
    if (nextTitle) {
      onRenameMessengerThread(activeMessengerThread.id, nextTitle);
    }
    setChatNameEditor({
      editing: false,
      threadId: activeMessengerThread.id,
      value: nextTitle || activeMessengerThread.title,
    });
  }

  function cancelChatNameEdit() {
    setChatNameEditor({
      editing: false,
      threadId: activeMessengerThread?.id ?? null,
      value: activeMessengerThread?.title ?? "",
    });
  }

  function updateChatNameValue(value: string) {
    setChatNameEditor({
      editing: true,
      threadId: activeMessengerThread?.id ?? null,
      value,
    });
  }

  return {
    activeChatName,
    activeChatNameEditor,
    cancelChatNameEdit,
    saveChatName,
    startChatNameEdit,
    updateChatNameValue,
  };
}
