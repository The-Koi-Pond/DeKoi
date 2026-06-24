import type { BubbleThread } from "../../engine/bubbles";

export function sortBubbleThreadsByUpdatedAt(threads: BubbleThread[]) {
  return [...threads].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getBubbleThreadInitials(title: string) {
  const initials = title
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return initials || "B";
}

export function getBubbleThreadPreview(thread: BubbleThread) {
  const lastMessage = thread.messages.at(-1);
  if (!lastMessage) return "No messages yet";

  const author =
    lastMessage.author.kind === "persona" ? "You" : lastMessage.author.label;
  return `${author}: ${lastMessage.body}`;
}

export function getBubbleThreadTimeLabel(updatedAt: string, now = Date.now()) {
  const updatedTime = Date.parse(updatedAt);
  if (Number.isNaN(updatedTime)) return "recently";

  const diffMs = Math.max(0, now - updatedTime);
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return "now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(updatedTime));
}
