const MESSAGE_TIME_FORMATTER = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});

const MESSAGE_DATE_TIME_FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

const MESSAGE_DATE_SEPARATOR_FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
});

export function getMessageDateKey(createdAt: string) {
  const createdTime = Date.parse(createdAt);
  if (Number.isNaN(createdTime)) return "";

  const createdDate = new Date(createdTime);
  const year = createdDate.getFullYear();
  const month = String(createdDate.getMonth() + 1).padStart(2, "0");
  const day = String(createdDate.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function getMessageDateSeparatorLabel(createdAt: string) {
  const createdTime = Date.parse(createdAt);
  if (Number.isNaN(createdTime)) return "";

  return MESSAGE_DATE_SEPARATOR_FORMATTER.format(new Date(createdTime));
}

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
