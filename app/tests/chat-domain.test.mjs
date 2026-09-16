import assert from "node:assert/strict";
import test from "node:test";
import {
  canAccessConversation,
  canRecallStoredMessage,
  createAlias,
  HttpError,
  normalizeConversationTags,
  optionalText,
  optionalUuid,
  requiredText,
  toConversation,
} from "../netlify/functions/_lib/chat-domain.mjs";

test("only the owner or an admin can access a conversation", () => {
  const conversation = { client_id: "client-a" };
  assert.equal(canAccessConversation({ id: "client-a", role: "client" }, conversation), true);
  assert.equal(canAccessConversation({ id: "client-b", role: "client" }, conversation), false);
  assert.equal(canAccessConversation({ id: "admin-a", role: "admin" }, conversation), true);
});

test("public conversation output never exposes the identity user id", () => {
  const output = toConversation(
    {
      id: "03dc0f75-b66f-4e2c-b70b-65b2957dd6a5",
      client_id: "secret-identity-id",
      alias: "云朵-123456",
      topic: "最近有点累",
      need: "希望有人先听我说说",
      status: "waiting",
      created_at: "2026-08-28T00:00:00.000Z",
      updated_at: "2026-08-28T00:00:00.000Z",
    },
    [],
  );

  assert.equal("clientId" in output, false);
  assert.equal("client_id" in output, false);
  assert.equal(JSON.stringify(output).includes("secret-identity-id"), false);
});

test("text validation trims values and rejects empty or oversized input", () => {
  assert.equal(requiredText("  hello  ", "消息", 10), "hello");
  assert.throws(() => requiredText("   ", "消息", 10), HttpError);
  assert.throws(() => requiredText("123456", "消息", 5), /不能超过 5/);
});

test("optional message text allows an image-only message but still enforces the limit", () => {
  assert.equal(optionalText("   ", "消息", 10), "");
  assert.equal(optionalText("  hello  ", "消息", 10), "hello");
  assert.throws(() => optionalText("123456", "消息", 5), /不能超过 5/);
});

test("server generated aliases use a non-identifying six digit suffix", () => {
  assert.match(createAlias(), /^云朵-\d{6}$/);
});

test("optional UUID validation accepts empty and canonical UUID values", () => {
  assert.equal(optionalUuid(undefined, "消息编号"), null);
  assert.equal(optionalUuid("", "消息编号"), null);
  assert.equal(optionalUuid("03dc0f75-b66f-4e2c-b70b-65b2957dd6a5", "消息编号"), "03dc0f75-b66f-4e2c-b70b-65b2957dd6a5");
  assert.throws(() => optionalUuid("not-a-uuid", "消息编号"), /格式不正确/);
});

test("administrator conversation tags are deduplicated and bounded", () => {
  assert.deepEqual(normalizeConversationTags([" 学业压力 ", "学业压力", "睡眠困扰"]), ["学业压力", "睡眠困扰"]);
  assert.throws(() => normalizeConversationTags(["一", "二", "三", "四", "五"]), /不能超过 4 个/);
  assert.throws(() => normalizeConversationTags(["这是一个明显超过十六个字符长度限制的标签"]), /不能超过 16 个字符/);
});

test("administrator state is exposed without leaking the administrator id", () => {
  const output = toConversation(
    {
      id: "03dc0f75-b66f-4e2c-b70b-65b2957dd6a5",
      alias: "云朵-123456",
      topic: "最近有点累",
      need: "希望有人先听我说说",
      status: "active",
      created_at: "2026-09-15T12:00:00.000Z",
      updated_at: "2026-09-15T12:01:30.000Z",
    },
    [],
    null,
    { admin_id: "secret-admin-id", is_pinned: true, tags: ["需要跟进"], last_read_at: "2026-09-15T12:01:00.000Z" },
  );
  assert.deepEqual(output.adminState, {
    pinned: true,
    tags: ["需要跟进"],
    lastReadAt: "2026-09-15T12:01:00.000Z",
    crisisStatus: "unreviewed",
    crisisSteps: {},
    crisisHistory: [],
  });
  assert.equal(JSON.stringify(output).includes("secret-admin-id"), false);
});

test("stored messages can only be recalled by their sender during the recall window", () => {
  const now = Date.parse("2026-09-15T12:00:00.000Z");
  const message = { sender: "client", created_at: new Date(now - 30_000).toISOString(), recalled_at: null };
  assert.equal(canRecallStoredMessage({ role: "client" }, message, now), true);
  assert.equal(canRecallStoredMessage({ role: "admin" }, message, now), false);
  assert.equal(canRecallStoredMessage({ role: "client" }, { ...message, recalled_at: new Date(now).toISOString() }, now), false);
  assert.equal(canRecallStoredMessage({ role: "client" }, { ...message, created_at: new Date(now - 120_001).toISOString() }, now), false);
});

test("public conversation output hides recalled content and keeps safe reply context", () => {
  const messages = [
    {
      id: "m1",
      sender: "client",
      body: "原始内容",
      attachments: [{ id: "a1", url: "private" }],
      recalled_at: "2026-09-15T12:01:00.000Z",
      created_at: "2026-09-15T12:00:00.000Z",
      reply_to_id: null,
    },
    {
      id: "m2",
      sender: "admin",
      body: "我在听",
      attachments: [],
      recalled_at: null,
      created_at: "2026-09-15T12:01:30.000Z",
      reply_to_id: "m1",
    },
  ];
  const output = toConversation(
    {
      id: "03dc0f75-b66f-4e2c-b70b-65b2957dd6a5",
      alias: "云朵-123456",
      topic: "最近有点累",
      need: "希望有人先听我说说",
      status: "active",
      ai_consent: true,
      created_at: "2026-09-15T12:00:00.000Z",
      updated_at: "2026-09-15T12:01:30.000Z",
    },
    messages,
  );

  assert.equal(output.messages[0].body, "");
  assert.deepEqual(output.messages[0].attachments, []);
  assert.equal(output.messages[1].replyTo.body, "原消息已撤回");
  assert.equal(output.messages[1].replyTo.hasImage, false);
});
