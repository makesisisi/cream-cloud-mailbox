import { getDatabase } from "@netlify/database";
import { HttpError, MAX_MESSAGE_LENGTH, requiredText } from "./_lib/chat-domain.mjs";
import {
  handleError,
  json,
  loadConversation,
  methodNotAllowed,
  parseJson,
  requireActor,
  requireConversation,
  requireSameOrigin,
} from "./_lib/chat-server.mjs";

const db = getDatabase();

export default async (request, context) => {
  try {
    if (request.method !== "POST") return methodNotAllowed(["POST"]);
    requireSameOrigin(request);
    const actor = await requireActor();
    const conversation = await requireConversation(actor, context.params.id);
    if (conversation.status === "closed") throw new HttpError(409, "这段会话已经结束，不能继续发送消息。");

    const payload = await parseJson(request);
    const body = requiredText(payload.body, "消息", MAX_MESSAGE_LENGTH);
    const sender = actor.role === "admin" ? "admin" : "client";
    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "INSERT INTO conversation_messages (id, conversation_id, sender, body) VALUES ($1, $2, $3, $4)",
        [crypto.randomUUID(), conversation.id, sender, body],
      );
      await client.query(
        "UPDATE conversations SET status = $1, updated_at = NOW() WHERE id = $2",
        [sender === "admin" ? "active" : "waiting", conversation.id],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    return json({ conversation: await loadConversation(actor, conversation.id) }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
};

export const config = { path: "/api/conversations/:id/messages" };
