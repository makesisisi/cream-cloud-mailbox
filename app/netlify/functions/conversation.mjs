import { HttpError } from "./_lib/chat-domain.mjs";
import { deleteConversationData } from "./_lib/chat-retention.mjs";
import {
  handleError,
  json,
  methodNotAllowed,
  loadConversation,
  requireActor,
  requireConversation,
  requireSameOrigin,
} from "./_lib/chat-server.mjs";
import { canDeleteConversation } from "../../shared/privacy-policy.mjs";

export default async (request, context) => {
  try {
    const actor = await requireActor();
    if (request.method === "GET") {
      return json({ conversation: await loadConversation(actor, context.params.id) });
    }
    if (request.method === "DELETE") {
      requireSameOrigin(request);
      const conversation = await requireConversation(actor, context.params.id);
      if (!canDeleteConversation(actor, conversation)) {
        throw new HttpError(403, "只有倾诉者本人可以永久删除这段会话。");
      }
      const deleted = await deleteConversationData(conversation.id, actor.id);
      if (!deleted) throw new HttpError(404, "没有找到这段会话。");
      return json({ deleted: true });
    }
    return methodNotAllowed(["GET", "DELETE"]);
  } catch (error) {
    return handleError(error);
  }
};

export const config = { path: "/api/conversations/:id" };
