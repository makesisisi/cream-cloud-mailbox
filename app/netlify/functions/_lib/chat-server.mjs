import { getDatabase } from "@netlify/database";
import { getUser, verifyRequestOrigin } from "@netlify/identity";
import { canAccessConversation, HttpError, toConversation } from "./chat-domain.mjs";
import { loadLatestAiAnalysis } from "./ai-assistant.mjs";

const db = getDatabase();

export async function requireActor() {
  const user = await getUser();
  if (!user) throw new HttpError(401, "请先登录后再继续。");
  return {
    id: user.id,
    role: user.roles?.includes("admin") ? "admin" : "client",
  };
}

export function requireSameOrigin(request) {
  try {
    verifyRequestOrigin(request);
  } catch {
    throw new HttpError(403, "请求来源校验失败，请刷新页面后重试。");
  }
}

export async function parseJson(request) {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "请求内容不是有效的 JSON。");
  }
}

export async function findConversation(id) {
  const { rows } = await db.pool.query("SELECT * FROM conversations WHERE id = $1", [id]);
  if (!rows[0]) throw new HttpError(404, "没有找到这段会话。");
  return rows[0];
}

export async function requireConversation(actor, id) {
  const conversation = await findConversation(id);
  if (!canAccessConversation(actor, conversation)) {
    throw new HttpError(403, "你没有权限查看这段会话。");
  }
  return conversation;
}

export function requireAdmin(actor) {
  if (actor.role !== "admin") throw new HttpError(403, "只有倾听员可以使用这个功能。");
}

export async function loadMessages(conversationId) {
  const { rows } = await db.pool.query(
    "SELECT id, sender, body, created_at FROM conversation_messages WHERE conversation_id = $1 ORDER BY created_at ASC, id ASC",
    [conversationId],
  );
  return rows;
}

export async function loadConversation(actor, id) {
  const conversation = await requireConversation(actor, id);
  const messages = await loadMessages(id);
  let aiAnalysis = null;
  if (actor.role === "admin") {
    try {
      aiAnalysis = await loadLatestAiAnalysis(id);
    } catch (error) {
      console.error("ai-analysis-load-error", { conversationId: id, code: error?.code });
    }
  }
  return toConversation(conversation, messages, aiAnalysis);
}

export function json(data, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "no-store");
  return Response.json(data, { ...init, headers });
}

export function handleError(error) {
  if (error instanceof HttpError) return json({ error: error.message }, { status: error.status });
  console.error("chat-api-error", error);
  return json({ error: "服务暂时不可用，请稍后再试。" }, { status: 500 });
}

export function methodNotAllowed(allowed) {
  return json(
    { error: "不支持这个请求方式。" },
    { status: 405, headers: { Allow: allowed.join(", ") } },
  );
}
