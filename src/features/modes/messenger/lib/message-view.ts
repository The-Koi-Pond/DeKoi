import type { ModeMessage } from "../../../../engine/contracts/types/mode-thread";
import { getActiveModeMessageVersion } from "../../../../engine/modes/mode-thread/mode-thread-actions";

export function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function getMessageClassName(message: ModeMessage) {
  return message.author.kind === "persona" ||
    (message.author.kind === "unknown" && message.author.label === "Anonymous")
    ? "messenger-message messenger-message-own"
    : "messenger-message";
}

/**
 * Stable key for grouping consecutive messages from the same author. Two
 * messages group together only when their author keys match; the render layer
 * additionally applies a time window so a long gap still re-opens the header.
 */
export function getMessageAuthorKey(message: ModeMessage) {
  const { author } = message;
  if (author.kind === "persona") return `persona:${author.personaId}`;
  if (author.kind === "character") return `character:${author.characterId}`;
  if (author.kind === "system") return `system:${author.label}`;
  return `unknown:${author.label}`;
}

export function getCopyableMessageBody(message: ModeMessage) {
  const body = getActiveModeMessageVersion(message).body;
  return body.trim() ? body : null;
}
