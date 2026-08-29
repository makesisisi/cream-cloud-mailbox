import { getDatabase } from "@netlify/database";
import { HttpError } from "./_lib/chat-domain.mjs";
import { loadLatestAiAnalysis, queueAiAnalysis, runAiAnalysis } from "./_lib/ai-assistant.mjs";
import {
  handleError,
  json,
  methodNotAllowed,
  requireActor,
  requireAdmin,
  requireConversation,
  requireSameOrigin,
} from "./_lib/chat-server.mjs";

const db = getDatabase();

export default async (request, context) => {
  try {
    const actor = await requireActor();
    requireAdmin(actor);
    const conversation = await requireConversation(actor, context.params.id);

    if (request.method === "GET") {
      return json({ analysis: await loadLatestAiAnalysis(conversation.id) });
    }
    if (request.method !== "POST") return methodNotAllowed(["GET", "POST"]);
    requireSameOrigin(request);
    if (!conversation.ai_consent) throw new HttpError(409, "倾诉者尚未开启 AI 辅助分析。");

    const { rows } = await db.pool.query(
      `SELECT id
         FROM conversation_messages
        WHERE conversation_id = $1 AND sender = 'client'
        ORDER BY created_at DESC, id DESC
        LIMIT 1`,
      [conversation.id],
    );
    if (!rows[0]) throw new HttpError(409, "还没有可以分析的倾诉消息。");

    const analysis = await queueAiAnalysis(conversation.id, rows[0].id);
    context.waitUntil(runAiAnalysis(conversation.id, rows[0].id));
    return json({ analysis }, { status: 202 });
  } catch (error) {
    return handleError(error);
  }
};

export const config = { path: "/api/conversations/:id/analysis" };
