import { useState, type FormEvent } from "react";
import {
  DEFAULT_MESSENGER_SYSTEM_PROMPT,
  type MessengerThread,
} from "../../../../engine/contracts/types/messenger";

interface UseChatSettingsPromptEditorInput {
  activeMessengerThread: MessengerThread | null;
  activeMessengerThreadId: string | null;
  sourcePrompt: string | null;
  onSaveCustomPrompt: (threadId: string, prompt: string) => void;
}

export function useChatSettingsPromptEditor({
  activeMessengerThread,
  activeMessengerThreadId,
  sourcePrompt,
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
          : sourcePrompt || DEFAULT_MESSENGER_SYSTEM_PROMPT,
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
    const promptThreadId = activePromptEditor.threadId;
    if (
      !promptThreadId ||
      !activeMessengerThread ||
      promptThreadId !== activeMessengerThreadId ||
      promptThreadId !== activeMessengerThread.id
    ) {
      closePromptEditor();
      return;
    }

    onSaveCustomPrompt(promptThreadId, activePromptEditor.value);
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
