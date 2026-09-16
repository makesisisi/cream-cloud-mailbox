import { getDatabase } from "@netlify/database";
import { deletePrivateImage } from "./chat-attachments.mjs";
import {
  CLOSED_CONVERSATION_RETENTION_DAYS,
  getClosedConversationCutoff,
} from "../../../shared/privacy-policy.mjs";

const db = getDatabase();
const CLEANUP_BATCH_SIZE = 100;

async function enqueueConversationAssets(client, conversationIds) {
  if (!conversationIds.length) return;
  await client.query(
    `INSERT INTO conversation_asset_deletion_queue (storage_key)
     SELECT storage_key
       FROM conversation_attachments
      WHERE conversation_id = ANY($1::uuid[])
     ON CONFLICT (storage_key) DO NOTHING`,
    [conversationIds],
  );
}

export async function deleteConversationData(conversationId, clientId) {
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      "SELECT id FROM conversations WHERE id = $1 AND client_id = $2 FOR UPDATE",
      [conversationId, clientId],
    );
    if (!rows[0]) {
      await client.query("ROLLBACK");
      return false;
    }
    await enqueueConversationAssets(client, [conversationId]);
    await client.query("DELETE FROM conversations WHERE id = $1 AND client_id = $2", [conversationId, clientId]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
  await cleanupQueuedConversationAssets().catch((error) => {
    console.error("conversation-asset-queue-drain-error", { conversationId, code: error?.code });
  });
  return true;
}

export async function purgeExpiredClosedConversations(now = new Date()) {
  const cutoff = getClosedConversationCutoff(now, CLOSED_CONVERSATION_RETENTION_DAYS);
  const client = await db.pool.connect();
  let conversationIds = [];
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `SELECT id
         FROM conversations
        WHERE status = 'closed' AND updated_at < $1
        ORDER BY updated_at ASC
        LIMIT $2
        FOR UPDATE SKIP LOCKED`,
      [cutoff.toISOString(), CLEANUP_BATCH_SIZE],
    );
    conversationIds = rows.map((row) => row.id);
    await enqueueConversationAssets(client, conversationIds);
    if (conversationIds.length) {
      await client.query("DELETE FROM conversations WHERE id = ANY($1::uuid[])", [conversationIds]);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
  return conversationIds.length;
}

export async function cleanupQueuedConversationAssets() {
  const { rows } = await db.pool.query(
    `SELECT storage_key
       FROM conversation_asset_deletion_queue
      ORDER BY queued_at ASC
      LIMIT $1`,
    [CLEANUP_BATCH_SIZE],
  );
  if (!rows.length) return { deleted: 0, failed: 0 };

  const results = await Promise.allSettled(rows.map((row) => deletePrivateImage(row.storage_key)));
  const succeeded = [];
  const failed = [];
  results.forEach((result, index) => {
    const storageKey = rows[index].storage_key;
    if (result.status === "fulfilled") succeeded.push(storageKey);
    else failed.push({ storageKey, error: result.reason });
  });

  if (succeeded.length) {
    await db.pool.query(
      "DELETE FROM conversation_asset_deletion_queue WHERE storage_key = ANY($1::text[])",
      [succeeded],
    );
  }
  for (const item of failed) {
    await db.pool.query(
      `UPDATE conversation_asset_deletion_queue
          SET attempts = attempts + 1, last_attempt_at = NOW()
        WHERE storage_key = $1`,
      [item.storageKey],
    );
    console.error("conversation-asset-cleanup-error", { storageKey: item.storageKey, code: item.error?.code });
  }
  return { deleted: succeeded.length, failed: failed.length };
}
