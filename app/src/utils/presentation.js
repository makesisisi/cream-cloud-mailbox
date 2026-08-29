const dayFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

const shortDateFormatter = new Intl.DateTimeFormat("zh-CN", {
  month: "numeric",
  day: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("zh-CN", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function startOfDay(value) {
  const date = new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function getGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 6) return "夜深了";
  if (hour < 11) return "早上好";
  if (hour < 14) return "中午好";
  if (hour < 18) return "下午好";
  return "晚上好";
}

export function formatTime(value) {
  return timeFormatter.format(new Date(value));
}

export function formatConversationDate(value, now = new Date()) {
  const date = startOfDay(value);
  const today = startOfDay(now);
  const difference = Math.round((today - date) / 86_400_000);
  if (difference === 0) return "今天";
  if (difference === 1) return "昨天";
  return dayFormatter.format(date);
}

export function formatListTime(value, now = new Date()) {
  const date = new Date(value);
  return formatConversationDate(date, now) === "今天"
    ? formatTime(date)
    : shortDateFormatter.format(date);
}

export function groupMessagesByDate(messages) {
  return messages.reduce((groups, message) => {
    const key = startOfDay(message.createdAt).toISOString();
    const current = groups.at(-1);
    if (current?.key === key) current.messages.push(message);
    else groups.push({ key, date: message.createdAt, messages: [message] });
    return groups;
  }, []);
}

export function getMessagePerspectiveClass(sender, viewerRole) {
  if (sender === "system") return "message-system";
  return sender === viewerRole ? "message-own" : "message-other";
}
