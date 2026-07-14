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

export function isOwnRoleplayMessage(message: ModeMessage) {
  return message.author.kind === "persona";
}

export function getCopyableRoleplayMessageBody(message: ModeMessage) {
  const body = getActiveModeMessageVersion(message).body;
  return body.trim() ? body : null;
}
