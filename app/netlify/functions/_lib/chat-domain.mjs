export const MAX_TOPIC_LENGTH = 120;
export const MAX_NEED_LENGTH = 200;
export const MAX_MESSAGE_LENGTH = 4000;

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

export function canAccessConversation(actor, conversation) {
  return actor.role === "admin" || conversation.client_id === actor.id;
}

export function toConversation(row, messages = [], aiAnalysis = null) {
  const conversation = {
    id: row.id,
    alias: row.alias,
    topic: row.topic,
    need: row.need,
    status: row.status,
    aiAssistanceEnabled: Boolean(row.ai_consent),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    messages: messages.map((message) => ({
      id: message.id,
      sender: message.sender,
      body: message.body,
      attachments: Array.isArray(message.attachments) ? message.attachments : [],
      createdAt: new Date(message.created_at).toISOString(),
    })),
  };
  if (aiAnalysis) conversation.aiAnalysis = aiAnalysis;
  return conversation;
}

export function createAlias() {
  const digits = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return `云朵-${String(digits).padStart(6, "0")}`;
}
