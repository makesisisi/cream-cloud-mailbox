import { getDatabase } from "@netlify/database";
import { HttpError, MAX_MESSAGE_LENGTH, optionalText } from "./_lib/chat-domain.mjs";
import { queueAiAnalysis, runAiAnalysis } from "./_lib/ai-assistant.mjs";
import {
  deletePrivateImage,
  storePrivateImage,
  validateImageUpload,
} from "./_lib/chat-attachments.mjs";
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

    const contentType = request.headers.get("content-type") ?? "";
    let rawBody = "";
    let image = null;
    if (contentType.toLowerCase().startsWith("multipart/form-data")) {
      const formData = await request.formData();
      rawBody = formData.get("body");
      const uploaded = formData.get("image");
      if (uploaded instanceof Blob && uploaded.size > 0) image = uploaded;
    } else {
      const payload = await parseJson(request);
      rawBody = payload.body;
    }
    const body = optionalText(rawBody, "消息", MAX_MESSAGE_LENGTH);
    if (!body && !image) throw new HttpError(400, "请写下消息或选择一张图片。");

    const sender = actor.role === "admin" ? "admin" : "client";
    const messageId = crypto.randomUUID();
    const attachmentId = image ? crypto.randomUUID() : null;
    let storedImageKey = null;
    let validatedImage = null;
    let client;
    try {
      client = await db.pool.connect();
      if (image) {
        validatedImage = await validateImageUpload(image);
        storedImageKey = await storePrivateImage({
          conversationId: conversation.id,
          messageId,
          attachmentId,
          bytes: validatedImage.bytes,
          contentType: validatedImage.contentType,
        });
      }
      await client.query("BEGIN");
      await client.query(
        "INSERT INTO conversation_messages (id, conversation_id, sender, body) VALUES ($1, $2, $3, $4)",
        [messageId, conversation.id, sender, body],
      );
      if (validatedImage) {
        await client.query(
          `INSERT INTO conversation_attachments
            (id, conversation_id, message_id, storage_key, content_type, size_bytes)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            attachmentId,
            conversation.id,
            messageId,
            storedImageKey,
            validatedImage.contentType,
            validatedImage.size,
          ],
        );
      }
      await client.query(
        "UPDATE conversations SET status = $1, updated_at = NOW() WHERE id = $2",
        [sender === "admin" ? "active" : "waiting", conversation.id],
      );
      await client.query("COMMIT");
    } catch (error) {
      if (client) await client.query("ROLLBACK").catch(() => undefined);
      if (storedImageKey) {
        try {
          await deletePrivateImage(storedImageKey);
        } catch (cleanupError) {
          console.error("image-cleanup-error", { messageId, code: cleanupError?.code });
        }
      }
      throw error;
    } finally {
      client?.release();
    }

    if (sender === "client") {
      try {
        const queued = await queueAiAnalysis(conversation.id, messageId);
        if (queued) context.waitUntil(runAiAnalysis(conversation.id, messageId));
      } catch (error) {
        console.error("ai-analysis-queue-error", { conversationId: conversation.id, code: error?.code });
      }
    }

    return json({ conversation: await loadConversation(actor, conversation.id) }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
};

export const config = { path: "/api/conversations/:id/messages" };
