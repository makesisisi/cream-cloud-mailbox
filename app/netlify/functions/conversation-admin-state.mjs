import { getDatabase } from "@netlify/database";
import { HttpError, normalizeConversationTags } from "./_lib/chat-domain.mjs";
import {
  handleError,
  json,
  loadConversation,
  methodNotAllowed,
  parseJson,
  requireAdmin,
  requireConversation,
  requireActor,
  requireSameOrigin,
} from "./_lib/chat-server.mjs";

const db = getDatabase();
const crisisStepKeys = new Set(["humanReviewed", "safetyChecked", "schoolSupportContacted", "trustedPersonContacted", "emergencyServicesContacted"]);

function nextCrisisStatus(steps) {
  if (steps.schoolSupportContacted || steps.emergencyServicesContacted) return "escalated";
  if (Object.values(steps).some(Boolean)) return "reviewing";
  return "unreviewed";
}

export default async (request, context) => {
  try {
    if (request.method !== "POST") return methodNotAllowed(["POST"]);
    const actor = await requireActor();
    requireAdmin(actor);
    requireSameOrigin(request);
    const conversationId = context.params.id;
    await requireConversation(actor, conversationId);
    const payload = await parseJson(request);
    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");
      const { rows } = await client.query(
        "SELECT is_pinned, tags, last_read_at, crisis_status, crisis_steps FROM admin_conversation_states WHERE conversation_id = $1 AND admin_id = $2 FOR UPDATE",
        [conversationId, actor.id],
      );
      const current = rows[0] ?? { is_pinned: false, tags: [], last_read_at: null, crisis_status: "unreviewed", crisis_steps: {} };
      const pinned = typeof payload.pinned === "boolean" ? payload.pinned : current.is_pinned;
      const tags = payload.tags === undefined ? current.tags : normalizeConversationTags(payload.tags);
      const lastReadAt = payload.markRead === true ? new Date().toISOString() : current.last_read_at;
      const steps = { ...(current.crisis_steps ?? {}) };
      let crisisStatus = current.crisis_status ?? "unreviewed";
      if (payload.crisisStep !== undefined) {
        const key = payload.crisisStep?.key;
        const completed = payload.crisisStep?.completed;
        if (!crisisStepKeys.has(key) || typeof completed !== "boolean") throw new HttpError(400, "危机处理步骤格式不正确。");
        steps[key] = completed;
        crisisStatus = nextCrisisStatus(steps);
        await client.query(
          "INSERT INTO conversation_crisis_actions (id, conversation_id, admin_id, action_key, completed) VALUES ($1, $2, $3, $4, $5)",
          [crypto.randomUUID(), conversationId, actor.id, key, completed],
        );
      }
      if (payload.crisisStatus !== undefined) {
        if (!new Set(["reviewing", "resolved"]).has(payload.crisisStatus)) throw new HttpError(400, "危机处理状态格式不正确。");
        if (payload.crisisStatus === "resolved" && !(steps.humanReviewed && steps.safetyChecked && steps.schoolSupportContacted)) {
          throw new HttpError(400, "完成交接前，请先完成人工复核、安全确认和校内支持连接。");
        }
        crisisStatus = payload.crisisStatus;
        await client.query(
          "INSERT INTO conversation_crisis_actions (id, conversation_id, admin_id, action_key, completed) VALUES ($1, $2, $3, $4, TRUE)",
          [crypto.randomUUID(), conversationId, actor.id, `status:${crisisStatus}`],
        );
      }
      await client.query(
        `INSERT INTO admin_conversation_states (conversation_id, admin_id, is_pinned, tags, last_read_at, crisis_status, crisis_steps, updated_at)
         VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7::jsonb, NOW())
         ON CONFLICT (conversation_id, admin_id) DO UPDATE
         SET is_pinned = EXCLUDED.is_pinned, tags = EXCLUDED.tags, last_read_at = EXCLUDED.last_read_at,
             crisis_status = EXCLUDED.crisis_status, crisis_steps = EXCLUDED.crisis_steps, updated_at = NOW()`,
        [conversationId, actor.id, pinned, JSON.stringify(tags), lastReadAt, crisisStatus, JSON.stringify(steps)],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    return json({ conversation: await loadConversation(actor, conversationId) });
  } catch (error) {
    return handleError(error);
  }
};

export const config = { path: "/api/conversations/:id/admin-state" };
