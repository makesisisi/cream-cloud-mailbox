import { getDatabase } from "@netlify/database";
import {
  canRecallStoredMessage,
  HttpError,
  MAX_MESSAGE_LENGTH,
  optionalText,
  optionalUuid,
} from "./_lib/chat-domain.mjs";
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
    if (!["POST", "DELETE"].includes(request.method)) return methodNotAllowed(["POST", "DELETE"]);
    requireSameOrigin(request);
    const actor = await requireActor();
    const conversation = await requireConversation(actor, context.params.id);
    if (conversation.status === "closed") throw new HttpError(409, "这段会话已经结束，不能继续发送消息。");

    if (request.method === "DELETE") {
      const payload = await parseJson(request);
      const messageId = optionalUuid(payload.messageId, "消息编号");
      if (!messageId) throw new HttpError(400, "请选择要撤回的消息。");
      const client = await db.pool.connect();
      let storageKeys = [];
      try {
        await client.query("BEGIN");
        const { rows } = await client.query(
          `SELECT id, sender, created_at, recalled_at
             FROM conversation_messages
            WHERE id = $1 AND conversation_id = $2
            FOR UPDATE`,
          [messageId, conversation.id],
        );
        const message = rows[0];
        if (!message) throw new HttpError(404, "没有找到这条消息。");
        if (!canRecallStoredMessage(actor, message)) {
          throw new HttpError(409, message.recalled_at ? "这条消息已经撤回。" : "消息只能由发送者在两分钟内撤回。");
        }
        const attachments = await client.query(
          "SELECT storage_key FROM conversation_attachments WHERE message_id = $1",
          [messageId],
        );
        storageKeys = attachments.rows.map((item) => item.storage_key);
        await client.query("DELETE FROM conversation_attachments WHERE message_id = $1", [messageId]);
        await client.query(
          "UPDATE conversation_messages SET body = '', recalled_at = NOW() WHERE id = $1",
          [messageId],
        );
        await client.query("UPDATE conversations SET updated_at = NOW() WHERE id = $1", [conversation.id]);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
      await Promise.all(storageKeys.map((key) => deletePrivateImage(key).catch((error) => {
        console.error("recalled-image-cleanup-error", { messageId, code: error?.code });
      })));
      return json({ conversation: await loadConversation(actor, conversation.id) });
    }

    const contentType = request.headers.get("content-type") ?? "";
    let rawBody = "";
    let image = null;
    let rawReplyToId = null;
    let rawClientMessageId = null;
    if (contentType.toLowerCase().startsWith("multipart/form-data")) {
      const formData = await request.formData();
      rawBody = formData.get("body");
      rawReplyToId = formData.get("replyToId");
      rawClientMessageId = formData.get("clientMessageId");
      const uploaded = formData.get("image");
      if (uploaded instanceof Blob && uploaded.size > 0) image = uploaded;
    } else {
      const payload = await parseJson(request);
      rawBody = payload.body;
      rawReplyToId = payload.replyToId;
      rawClientMessageId = payload.clientMessageId;
    }
    const body = optionalText(rawBody, "消息", MAX_MESSAGE_LENGTH);
    const replyToId = optionalUuid(rawReplyToId, "引用消息编号");
    const clientMessageId = optionalUuid(rawClientMessageId, "客户端消息编号");
    if (!body && !image) throw new HttpError(400, "请写下消息或选择一张图片。");

    const sender = actor.role === "admin" ? "admin" : "client";
    if (clientMessageId) {
      const { rows } = await db.pool.query(
        "SELECT id FROM conversation_messages WHERE conversation_id = $1 AND client_message_id = $2 AND sender = $3 LIMIT 1",
        [conversation.id, clientMessageId, sender],
      );
      if (rows[0]) return json({ conversation: await loadConversation(actor, conversation.id) });
    }
    if (replyToId) {
      const { rows } = await db.pool.query(
        "SELECT id FROM conversation_messages WHERE id = $1 AND conversation_id = $2 AND sender <> 'system' LIMIT 1",
        [replyToId, conversation.id],
      );
      if (!rows[0]) throw new HttpError(400, "引用的消息不存在或不能被引用。");
    }
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
        `INSERT INTO conversation_messages
          (id, conversation_id, sender, body, reply_to_id, client_message_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [messageId, conversation.id, sender, body, replyToId, clientMessageId],
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
