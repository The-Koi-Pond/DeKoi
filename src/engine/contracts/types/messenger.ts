import type { PromptPresetChoiceSelections } from "./prompt-presets";

type MessengerThreadKind = "messenger";
export type MessengerThreadMode = "direct" | "group";
export type MessengerMessageOrigin = "manual" | "generated" | "imported" | "placeholder" | "sample";
export type MessengerSystemPromptMode = "default" | "custom";

export const DEFAULT_MESSENGER_SYSTEM_PROMPT = `<role>
You are {{char}}, texting privately with {{user}} in a casual DM conversation.
Treat this like an ongoing chat with someone you know, not a roleplay scene, essay, or assistant exchange.
</role>

<rules>
Here are the rules for the interaction:
- Stay in character based on your personality, description, memories, and relationship with {{user}}.
- Sound like a person texting. Be casual, specific, and reactive. Do not sound like an assistant, therapist, narrator, or writing partner.
- Default to short replies. One line, a fragment, a quick reaction, or even just an emoji can be enough.
- Only send longer messages when the moment genuinely calls for it, like telling a story, explaining something personal, arguing a point, or responding to something emotionally complicated.
- No roleplay formatting: no *actions*, no narration, no quoted dialogue, no stage directions.
- Do not describe your facial expressions, body language, surroundings, or actions unless {{char}} would naturally text about them.
- Do not over-explain your feelings. Let subtext, hesitation, teasing, bluntness, silence, or topic changes carry meaning when they fit.
- Do not turn every message into a polished paragraph. Texts can be messy, brief, lowercase, interrupted, dry, affectionate, sarcastic, or uncertain.
- React to what {{user}} actually said. Do not summarize the conversation back at them unless that is naturally how {{char}} would talk.
- Ask questions only when they feel natural. Do not end every message with a question just to keep the chat going.
- Use emojis, slang, profanity, flirting, dark jokes, or internet language only if they fit {{char}} and the moment.
- Adult topics are allowed when they fit the conversation and character. Treat them like part of a real private chat, not as a special mode shift.
- Messages may include timestamps like [12:01] or dates like [18.03.2026]. Use them only to understand timing. Never include timestamps, dates, brackets, or metadata in your replies.
- Your output must contain only {{char}}'s natural message text.
</rules>`;

export function normalizeMessengerSystemPromptMode(value: unknown): MessengerSystemPromptMode {
  return value === "custom" ? "custom" : "default";
}

export function resolveMessengerSystemPrompt(
  thread: MessengerThread,
  presetSystemPrompt: string | null = null,
) {
  if (thread.systemPromptMode === "custom" && thread.systemPrompt.trim()) {
    return thread.systemPrompt.trim();
  }

  if (presetSystemPrompt?.trim()) {
    return presetSystemPrompt.trim();
  }

  return DEFAULT_MESSENGER_SYSTEM_PROMPT;
}

export type MessengerMessageAuthor =
  | {
      kind: "persona";
      personaId: string;
      label: string;
    }
  | {
      kind: "character";
      characterId: string;
      label: string;
    }
  | {
      kind: "system";
      label: string;
    }
  | {
      kind: "unknown";
      label: string;
    };

export interface MessengerMessage {
  id: string;
  schemaVersion: 1;
  threadId: string;
  author: MessengerMessageAuthor;
  body: string;
  origin: MessengerMessageOrigin;
  createdAt: string;
  updatedAt: string;
}

export interface MessengerThread {
  id: string;
  schemaVersion: 1;
  kind: MessengerThreadKind;
  mode: MessengerThreadMode;
  title: string;
  characterIds: string[];
  activePersonaId: string | null;
  lorebookIds: string[];
  presetId: string | null;
  presetChoiceSelections?: PromptPresetChoiceSelections;
  providerConnectionId: string | null;
  systemPromptMode: MessengerSystemPromptMode;
  systemPrompt: string;
  messages: MessengerMessage[];
  createdAt: string;
  updatedAt: string;
}

export type MessengerThreadRecord = Omit<MessengerThread, "messages">;

export function toMessengerThreadRecord(thread: MessengerThread): MessengerThreadRecord {
  const { messages, ...record } = thread;
  void messages;
  return record;
}

export function extractMessengerMessages(threads: readonly MessengerThread[]): MessengerMessage[] {
  return threads.flatMap((thread) =>
    thread.messages.map((message) => ({
      ...message,
      schemaVersion: 1,
      threadId: thread.id,
    })),
  );
}

function mergeMessengerMessages(
  embeddedMessages: readonly MessengerMessage[],
  storedMessages: readonly MessengerMessage[],
) {
  if (storedMessages.length === 0) return [...embeddedMessages];

  const storedMessageIds = new Set(storedMessages.map((message) => message.id));
  const embeddedOnlyMessages = embeddedMessages.filter(
    (message) => !storedMessageIds.has(message.id),
  );

  return [...embeddedOnlyMessages, ...storedMessages];
}

export function attachMessengerMessagesToThreads(
  threads: readonly (MessengerThread | MessengerThreadRecord)[],
  messages: readonly MessengerMessage[],
): MessengerThread[] {
  const messagesByThreadId = new Map<string, MessengerMessage[]>();
  for (const message of messages) {
    const threadMessages = messagesByThreadId.get(message.threadId) ?? [];
    threadMessages.push(message);
    messagesByThreadId.set(message.threadId, threadMessages);
  }

  return threads.map((thread) => {
    const embeddedMessages =
      "messages" in thread && Array.isArray(thread.messages) ? thread.messages : [];
    const storedMessages = messagesByThreadId.get(thread.id) ?? [];

    return {
      ...toMessengerThreadRecord({
        ...thread,
        messages: embeddedMessages,
      }),
      messages: mergeMessengerMessages(embeddedMessages, storedMessages),
    };
  });
}

export function getMessengerThreadActivityAt(thread: MessengerThread) {
  return thread.messages.reduce(
    (latest, message) => (message.updatedAt.localeCompare(latest) > 0 ? message.updatedAt : latest),
    thread.updatedAt,
  );
}
