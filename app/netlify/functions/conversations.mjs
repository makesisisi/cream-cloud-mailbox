import { getDatabase } from "@netlify/database";
import { ensureAiAnalysisSchema, loadLatestAiAnalyses } from "./_lib/ai-assistant.mjs";
import {
  createAlias,
  HttpError,
  MAX_NEED_LENGTH,
  MAX_TOPIC_LENGTH,
  requiredText,
  toConversation,
} from "./_lib/chat-domain.mjs";
import {
  handleError,
  json,
  loadMessages,
  methodNotAllowed,
  parseJson,
  attachPublicAttachments,
  requireActor,
  requireSameOrigin,
} from "./_lib/chat-server.mjs";

const db = getDatabase();

async function listConversations(actor) {
  const values = [];
  const where = actor.role === "admin" ? "" : "WHERE client_id = $1";
  if (actor.role !== "admin") values.push(actor.id);

  const { rows: conversations } = await db.pool.query(
    `SELECT * FROM conversations ${where} ORDER BY updated_at DESC LIMIT 100`,
    values,
  );
  if (!conversations.length) return [];

  const ids = conversations.map((conversation) => conversation.id);
  const { rows: messages } = await db.pool.query(
    "SELECT id, conversation_id, sender, body, created_at FROM conversation_messages WHERE conversation_id = ANY($1::uuid[]) ORDER BY created_at ASC, id ASC",
    [ids],
  );
  const { rows: attachments } = await db.pool.query(
    "SELECT id, conversation_id, message_id, content_type, size_bytes FROM conversation_attachments WHERE conversation_id = ANY($1::uuid[]) ORDER BY created_at ASC, id ASC",
    [ids],
  );
  const messagesWithAttachments = attachPublicAttachments(messages, attachments);
  const grouped = new Map();
  for (const message of messagesWithAttachments) {
    const items = grouped.get(message.conversation_id) ?? [];
    items.push(message);
    grouped.set(message.conversation_id, items);
  }
  let analyses = new Map();
  if (actor.role === "admin") {
    try {
      analyses = await loadLatestAiAnalyses(ids);
    } catch (error) {
      console.error("ai-analysis-list-error", { code: error?.code });
    }
  }
  return conversations.map((conversation) =>
    toConversation(conversation, grouped.get(conversation.id) ?? [], analyses.get(conversation.id) ?? null),
  );
}

async function createConversation(actor, request) {
  if (actor.role === "admin") throw new HttpError(403, "管理员不能以倾听员身份创建来访会话。");
  requireSameOrigin(request);
  const payload = await parseJson(request);
  const topic = requiredText(payload.topic, "倾诉主题", MAX_TOPIC_LENGTH);
  const need = requiredText(payload.need, "倾听期待", MAX_NEED_LENGTH);
  const aiConsent = payload.aiConsent === true;
  const client = await db.pool.connect();

  try {
    await ensureAiAnalysisSchema();
    await client.query("BEGIN");
    const existing = await client.query(
      "SELECT * FROM conversations WHERE client_id = $1 AND status <> 'closed' LIMIT 1 FOR UPDATE",
      [actor.id],
    );
    if (existing.rows[0]) {
      await client.query("COMMIT");
      return toConversation(existing.rows[0], await loadMessages(existing.rows[0].id));
    }

    const id = crypto.randomUUID();
    const alias = createAlias();
    const inserted = await client.query(
      "INSERT INTO conversations (id, client_id, alias, topic, need, ai_consent) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
      [id, actor.id, alias, topic, need, aiConsent],
    );
    const systemMessage = await client.query(
      "INSERT INTO conversation_messages (id, conversation_id, sender, body) VALUES ($1, $2, 'system', $3) RETURNING id, sender, body, created_at",
      [crypto.randomUUID(), id, "会话已经创建。倾听员上线后会尽快回应，你可以从任何地方开始说。"],
    );
    await client.query("COMMIT");
    return toConversation(inserted.rows[0], systemMessage.rows);
  } catch (error) {
    await client.query("ROLLBACK");
    if (error?.code === "23505") {
      const { rows } = await db.pool.query(
        "SELECT * FROM conversations WHERE client_id = $1 AND status <> 'closed' LIMIT 1",
        [actor.id],
      );
      if (rows[0]) {
        return toConversation(rows[0], await loadMessages(rows[0].id));
      }
    }
    throw error;
  } finally {
    client.release();
  }
}

export default async (request) => {
  try {
    const actor = await requireActor();
    if (request.method === "GET") return json({ conversations: await listConversations(actor) });
    if (request.method === "POST") {
      const conversation = await createConversation(actor, request);
      return json({ conversation }, { status: 201 });
    }
    return methodNotAllowed(["GET", "POST"]);
  } catch (error) {
    return handleError(error);
  }
};

export const config = { path: "/api/conversations" };
