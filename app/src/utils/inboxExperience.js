export const conversationTagOptions = ["需要跟进", "学业压力", "人际关系", "睡眠困扰"];

export function getConversationUnreadCount(conversation) {
  const lastReadAt = Date.parse(conversation.adminState?.lastReadAt ?? "");
  return conversation.messages.filter((message) => {
    if (message.sender !== "client" || message.recalledAt) return false;
    const createdAt = Date.parse(message.createdAt);
    return !Number.isFinite(lastReadAt) || (Number.isFinite(createdAt) && createdAt > lastReadAt);
  }).length;
}

export function getConversationRiskRank(conversation) {
  if (conversation.aiAnalysis?.safetyLevel === "urgent") return 2;
  if (conversation.aiAnalysis?.safetyLevel === "watch") return 1;
  return 0;
}

export function getLastReplyMeta(conversation) {
  const lastMessage = conversation.messages.filter((message) => message.sender !== "system").at(-1);
  return {
    message: lastMessage ?? null,
    label: lastMessage?.sender === "admin" ? "我回复" : lastMessage?.sender === "client" ? "新倾诉" : "暂无消息",
    createdAt: lastMessage?.createdAt ?? conversation.updatedAt,
  };
}

export function matchesConversationSearch(conversation, search) {
  const query = search.trim().toLocaleLowerCase("zh-CN");
  if (!query) return true;
  const searchable = [
    conversation.alias,
    conversation.topic,
    conversation.need,
    ...(conversation.adminState?.tags ?? []),
  ].filter(Boolean).join(" ").toLocaleLowerCase("zh-CN");
  return searchable.includes(query);
}

export function sortAdminConversations(conversations) {
  return [...conversations].sort((left, right) => {
    const pinned = Number(Boolean(right.adminState?.pinned)) - Number(Boolean(left.adminState?.pinned));
    if (pinned) return pinned;
    const risk = getConversationRiskRank(right) - getConversationRiskRank(left);
    if (risk) return risk;
    const unread = getConversationUnreadCount(right) - getConversationUnreadCount(left);
    if (unread) return unread;
    return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
  });
}
