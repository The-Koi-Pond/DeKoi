import type { MessengerMessage } from "../../../../engine/contracts/types/messenger";

export function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function getMessageClassName(message: MessengerMessage) {
  return message.author.kind === "persona" ||
    (message.author.kind === "unknown" && message.author.label === "Anonymous")
    ? "messenger-message messenger-message-own"
    : "messenger-message";
}
