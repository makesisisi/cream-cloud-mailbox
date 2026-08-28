import assert from "node:assert/strict";
import test from "node:test";
import {
  canAccessConversation,
  createAlias,
  HttpError,
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

test("server generated aliases use a non-identifying six digit suffix", () => {
  assert.match(createAlias(), /^云朵-\d{6}$/);
});
