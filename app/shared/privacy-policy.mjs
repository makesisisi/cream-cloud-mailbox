export const CLOSED_CONVERSATION_RETENTION_DAYS = 90;

export function canDeleteConversation(actor, conversation) {
  return actor?.role === "client"
    && Boolean(actor.id)
    && conversation?.client_id === actor.id;
}

export function getClosedConversationCutoff(
  now = new Date(),
  retentionDays = CLOSED_CONVERSATION_RETENTION_DAYS,
) {
  const timestamp = now instanceof Date ? now.getTime() : new Date(now).getTime();
  if (!Number.isFinite(timestamp)) throw new TypeError("清理时间无效。");
  if (!Number.isInteger(retentionDays) || retentionDays < 1) throw new TypeError("保留天数必须是正整数。");
  return new Date(timestamp - retentionDays * 24 * 60 * 60 * 1000);
}
