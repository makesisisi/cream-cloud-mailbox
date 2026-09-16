export const MESSAGE_RECALL_WINDOW_MS = 2 * 60 * 1000;

export function isOwnMessage(message, viewerRole) {
  return message?.sender === viewerRole;
}

export function canRecallMessage(message, viewerRole, now = Date.now()) {
  if (!message || message.sender === "system" || message.recalledAt || !isOwnMessage(message, viewerRole)) return false;
  const createdAt = Date.parse(message.createdAt);
  return Number.isFinite(createdAt) && now - createdAt >= 0 && now - createdAt <= MESSAGE_RECALL_WINDOW_MS;
}

export function createReplySnapshot(message) {
  if (!message || message.sender === "system") return null;
  return {
    id: message.id,
    sender: message.sender,
    body: message.recalledAt ? "原消息已撤回" : message.body,
    hasImage: !message.recalledAt && Boolean(message.attachments?.length),
    recalledAt: message.recalledAt,
  };
}

export function getReplySummary(replyTo) {
  if (!replyTo) return "";
  if (replyTo.recalledAt) return "原消息已撤回";
  return replyTo.body || (replyTo.hasImage ? "[图片]" : "一条消息");
}
