import { handleError, json, methodNotAllowed, loadConversation, requireActor } from "./_lib/chat-server.mjs";

export default async (request, context) => {
  try {
    if (request.method !== "GET") return methodNotAllowed(["GET"]);
    const actor = await requireActor();
    return json({ conversation: await loadConversation(actor, context.params.id) });
  } catch (error) {
    return handleError(error);
  }
};

export const config = { path: "/api/conversations/:id" };
