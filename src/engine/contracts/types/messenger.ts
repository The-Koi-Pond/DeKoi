import type { PromptPresetThreadChoiceSelections } from "./prompt-presets";

type MessengerThreadKind = "messenger";
export type MessengerThreadMode = "direct" | "group";
export type MessengerMessageOrigin = "manual" | "generated" | "imported" | "placeholder" | "sample";

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
  presetChoiceSelectionsByPresetId?: Record<string, PromptPresetThreadChoiceSelections>;
  providerConnectionId: string | null;
  messages: MessengerMessage[];
  createdAt: string;
  updatedAt: string;
}
