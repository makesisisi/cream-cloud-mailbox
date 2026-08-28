import { getDatabase } from "@netlify/database";
import {
  handleError,
  json,
  loadConversation,
  methodNotAllowed,
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
    if (conversation.status !== "closed") {
      await db.pool.query(
        "UPDATE conversations SET status = 'closed', updated_at = NOW() WHERE id = $1",
        [conversation.id],
      );
    }
    return json({ conversation: await loadConversation(actor, conversation.id) });
  } catch (error) {
    return handleError(error);
  }
};

export const config = { path: "/api/conversations/:id/close" };
