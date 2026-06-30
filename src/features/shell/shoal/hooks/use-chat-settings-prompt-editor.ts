import { useState, type FormEvent } from "react";
import {
  DEFAULT_MESSENGER_SYSTEM_PROMPT,
  type MessengerThread,
} from "../../../../engine/contracts/types/messenger";

interface UseChatSettingsPromptEditorInput {
  activeMessengerThread: MessengerThread | null;
  activeMessengerThreadId: string | null;
  onSaveCustomPrompt: (prompt: string) => void;
}

export function useChatSettingsPromptEditor({
  activeMessengerThread,
  activeMessengerThreadId,
  onSaveCustomPrompt,
}: UseChatSettingsPromptEditorInput) {
  const [promptEditor, setPromptEditor] = useState<{
    open: boolean;
    threadId: string | null;
    value: string;
  }>({
    open: false,
    threadId: null,
    value: "",
  });
  const activePromptEditor =
    promptEditor.open && promptEditor.threadId === activeMessengerThreadId
      ? promptEditor
      : {
          open: false,
          threadId: null,
          value: "",
        };

  function openPromptEditor() {
    if (!activeMessengerThread) return;
    setPromptEditor({
      open: true,
      threadId: activeMessengerThread.id,
      value:
        activeMessengerThread.systemPromptMode === "custom"
          ? activeMessengerThread.systemPrompt || DEFAULT_MESSENGER_SYSTEM_PROMPT
          : DEFAULT_MESSENGER_SYSTEM_PROMPT,
    });
  }

  function closePromptEditor() {
    setPromptEditor({
      open: false,
      threadId: null,
      value: "",
    });
  }

  function savePromptEditor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !activeMessengerThread ||
      activePromptEditor.threadId !== activeMessengerThreadId ||
      activePromptEditor.threadId !== activeMessengerThread.id
    ) {
      closePromptEditor();
      return;
    }

    onSaveCustomPrompt(activePromptEditor.value);
    closePromptEditor();
  }

  function updatePromptEditorValue(value: string) {
    setPromptEditor((current) => ({
      ...current,
      value,
    }));
  }

  return {
    activePromptEditor,
    closePromptEditor,
    openPromptEditor,
    savePromptEditor,
    updatePromptEditorValue,
  };
}
