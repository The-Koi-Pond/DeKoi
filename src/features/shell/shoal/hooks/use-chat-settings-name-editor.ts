import { useState } from "react";
import type { ChatSettingsThreadRecord } from "../lib/chat-settings-thread-record";

interface UseChatSettingsNameEditorInput {
  activeThread: ChatSettingsThreadRecord | null;
  activeThreadId: string | null;
  onRenameThread: (threadId: string, title: string) => void;
}

export function useChatSettingsNameEditor({
  activeThread,
  activeThreadId,
  onRenameThread,
}: UseChatSettingsNameEditorInput) {
  const activeThreadTitle = activeThread?.title ?? "";
  const [chatNameEditor, setChatNameEditor] = useState<{
    editing: boolean;
    threadId: string | null;
    value: string;
  }>({
    editing: false,
    threadId: activeThread?.id ?? null,
    value: activeThread?.title ?? "",
  });
  const activeChatName = activeThread?.title.trim() || "Untitled chat";
  const activeChatNameEditor =
    chatNameEditor.threadId === activeThreadId
      ? chatNameEditor
      : {
          editing: false,
          threadId: activeThreadId,
          value: activeThreadTitle,
        };

  function startChatNameEdit() {
    if (!activeThread) return;
    setChatNameEditor({
      editing: true,
      threadId: activeThread.id,
      value: activeThread.title,
    });
  }

  function saveChatName() {
    if (
      !activeThread ||
      activeChatNameEditor.threadId !== activeThreadId ||
      activeChatNameEditor.threadId !== activeThread.id
    ) {
      cancelChatNameEdit();
      return;
    }
    const nextTitle = activeChatNameEditor.value.trim();
    if (nextTitle) {
      onRenameThread(activeThread.id, nextTitle);
    }
    setChatNameEditor({
      editing: false,
      threadId: activeThread.id,
      value: nextTitle || activeThread.title,
    });
  }

  function cancelChatNameEdit() {
    setChatNameEditor({
      editing: false,
      threadId: activeThread?.id ?? null,
      value: activeThread?.title ?? "",
    });
  }

  function updateChatNameValue(value: string) {
    setChatNameEditor({
      editing: true,
      threadId: activeThread?.id ?? null,
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
