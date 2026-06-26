const MESSAGE_TIME_FORMATTER = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});

const MESSAGE_DATE_TIME_FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

export function getMessageTimeLabel(createdAt: string) {
  const createdTime = Date.parse(createdAt);
  if (Number.isNaN(createdTime)) return "";

  return MESSAGE_TIME_FORMATTER.format(new Date(createdTime));
}

export function getMessageDateTimeTitle(createdAt: string) {
  const createdTime = Date.parse(createdAt);
  if (Number.isNaN(createdTime)) return undefined;

  return MESSAGE_DATE_TIME_FORMATTER.format(new Date(createdTime));
}
