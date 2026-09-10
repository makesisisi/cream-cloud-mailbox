import { getDatabase } from "@netlify/database";
import { HttpError } from "./_lib/chat-domain.mjs";
import { readPrivateImage } from "./_lib/chat-attachments.mjs";
import {
  handleError,
  methodNotAllowed,
  requireActor,
  requireConversation,
} from "./_lib/chat-server.mjs";

const db = getDatabase();

export default async (request, context) => {
  try {
    if (request.method !== "GET") return methodNotAllowed(["GET"]);
    const actor = await requireActor();
    const conversation = await requireConversation(actor, context.params.id);
    const { rows } = await db.pool.query(
      `SELECT storage_key, content_type
         FROM conversation_attachments
        WHERE id = $1 AND conversation_id = $2`,
      [context.params.attachmentId, conversation.id],
    );
    if (!rows[0]) throw new HttpError(404, "没有找到这张图片。");
    const stream = await readPrivateImage(rows[0].storage_key, "stream");
    if (!stream) throw new HttpError(404, "没有找到这张图片。");

    const extension = rows[0].content_type === "image/jpeg" ? "jpg" : rows[0].content_type.split("/")[1];
    return new Response(stream, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Type": rows[0].content_type,
        "Content-Disposition": `inline; filename="conversation-image.${extension}"`,
        "X-Content-Type-Options": "nosniff",
        "Cross-Origin-Resource-Policy": "same-origin",
      },
    });
  } catch (error) {
    return handleError(error);
  }
};

export const config = { path: "/api/conversations/:id/attachments/:attachmentId" };
