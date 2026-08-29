import { getDatabase } from "@netlify/database";
import { HttpError } from "./_lib/chat-domain.mjs";
import { ensureAiAnalysisSchema } from "./_lib/ai-assistant.mjs";
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
    if (actor.role !== "client") throw new HttpError(403, "只有倾诉者本人可以更改 AI 辅助设置。");
    const conversation = await requireConversation(actor, context.params.id);
    const payload = await parseJson(request);
    if (typeof payload.enabled !== "boolean") throw new HttpError(400, "AI 辅助设置无效。");

    await ensureAiAnalysisSchema();
    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("UPDATE conversations SET ai_consent = $1 WHERE id = $2", [payload.enabled, conversation.id]);
      if (!payload.enabled) {
        await client.query("DELETE FROM conversation_ai_analyses WHERE conversation_id = $1", [conversation.id]);
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    return json({ conversation: await loadConversation(actor, conversation.id) });
  } catch (error) {
    return handleError(error);
  }
};

export const config = { path: "/api/conversations/:id/ai-consent" };
