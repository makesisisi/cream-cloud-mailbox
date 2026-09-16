export const MAX_TOPIC_LENGTH = 120;
export const MAX_NEED_LENGTH = 200;
export const MAX_MESSAGE_LENGTH = 4000;
export const MESSAGE_RECALL_WINDOW_MS = 2 * 60 * 1000;
export const MAX_CONVERSATION_TAGS = 4;
export const MAX_CONVERSATION_TAG_LENGTH = 16;

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

export function requiredText(value, fieldName, maxLength) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw new HttpError(400, `${fieldName}不能为空。`);
  if (text.length > maxLength) throw new HttpError(400, `${fieldName}不能超过 ${maxLength} 个字符。`);
  return text;
}

export function optionalText(value, fieldName, maxLength) {
  const text = typeof value === "string" ? value.trim() : "";
  if (text.length > maxLength) throw new HttpError(400, `${fieldName}不能超过 ${maxLength} 个字符。`);
  return text;
}

export function optionalUuid(value, fieldName) {
  if (value === undefined || value === null || value === "") return null;
  const id = typeof value === "string" ? value.trim() : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(id)) {
    throw new HttpError(400, `${fieldName}格式不正确。`);
  }
  return id;
}

export function normalizeConversationTags(value) {
  if (!Array.isArray(value)) throw new HttpError(400, "会话标签格式不正确。");
  const tags = [...new Set(value.map((tag) => typeof tag === "string" ? tag.trim() : "").filter(Boolean))];
  if (tags.length > MAX_CONVERSATION_TAGS) throw new HttpError(400, `会话标签不能超过 ${MAX_CONVERSATION_TAGS} 个。`);
  if (tags.some((tag) => tag.length > MAX_CONVERSATION_TAG_LENGTH)) {
    throw new HttpError(400, `每个会话标签不能超过 ${MAX_CONVERSATION_TAG_LENGTH} 个字符。`);
  }
  return tags;
}

export function canRecallStoredMessage(actor, message, now = Date.now()) {
  if (!message || message.sender === "system" || message.recalled_at) return false;
  const sender = actor.role === "admin" ? "admin" : "client";
  const createdAt = new Date(message.created_at).getTime();
  return message.sender === sender
    && Number.isFinite(createdAt)
    && now - createdAt >= 0
    && now - createdAt <= MESSAGE_RECALL_WINDOW_MS;
}

export function canAccessConversation(actor, conversation) {
  return actor.role === "admin" || conversation.client_id === actor.id;
}

export function toConversation(row, messages = [], aiAnalysis = null, adminState = null) {
  const messageMap = new Map(messages.map((message) => [message.id, message]));
  const conversation = {
    id: row.id,
    alias: row.alias,
    topic: row.topic,
    need: row.need,
    status: row.status,
    aiAssistanceEnabled: Boolean(row.ai_consent),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    messages: messages.map((message) => {
      const recalledAt = message.recalled_at ? new Date(message.recalled_at).toISOString() : null;
      const reply = message.reply_to_id ? messageMap.get(message.reply_to_id) : null;
      const replyRecalledAt = reply?.recalled_at ? new Date(reply.recalled_at).toISOString() : null;
      return {
        id: message.id,
        sender: message.sender,
        body: recalledAt ? "" : message.body,
        attachments: recalledAt ? [] : Array.isArray(message.attachments) ? message.attachments : [],
        createdAt: new Date(message.created_at).toISOString(),
        ...(recalledAt ? { recalledAt } : {}),
        ...(reply ? {
          replyTo: {
            id: reply.id,
            sender: reply.sender,
            body: replyRecalledAt ? "原消息已撤回" : reply.body,
            hasImage: !replyRecalledAt && Boolean(reply.attachments?.length),
            ...(replyRecalledAt ? { recalledAt: replyRecalledAt } : {}),
          },
        } : {}),
      };
    }),
  };
  if (aiAnalysis) conversation.aiAnalysis = aiAnalysis;
  if (adminState) {
    conversation.adminState = {
      pinned: Boolean(adminState.is_pinned),
      tags: Array.isArray(adminState.tags) ? adminState.tags : [],
      lastReadAt: adminState.last_read_at ? new Date(adminState.last_read_at).toISOString() : null,
      crisisStatus: adminState.crisis_status ?? "unreviewed",
      crisisSteps: adminState.crisis_steps && typeof adminState.crisis_steps === "object" ? adminState.crisis_steps : {},
      crisisHistory: Array.isArray(adminState.crisis_history) ? adminState.crisis_history.map((entry) => ({
        id: entry.id,
        actionKey: entry.action_key,
        completed: Boolean(entry.completed),
        createdAt: new Date(entry.created_at).toISOString(),
      })) : [],
    };
  }
  return conversation;
}

export function createAlias() {
  const digits = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return `云朵-${String(digits).padStart(6, "0")}`;
}
