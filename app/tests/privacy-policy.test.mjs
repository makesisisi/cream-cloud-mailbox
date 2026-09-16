import assert from "node:assert/strict";
import test from "node:test";
import {
  canDeleteConversation,
  CLOSED_CONVERSATION_RETENTION_DAYS,
  getClosedConversationCutoff,
} from "../shared/privacy-policy.mjs";

test("only the owning client can permanently delete a conversation", () => {
  const conversation = { client_id: "client-a" };
  assert.equal(canDeleteConversation({ id: "client-a", role: "client" }, conversation), true);
  assert.equal(canDeleteConversation({ id: "client-b", role: "client" }, conversation), false);
  assert.equal(canDeleteConversation({ id: "admin-a", role: "admin" }, conversation), false);
});

test("closed conversation cutoff uses the published retention period", () => {
  assert.equal(CLOSED_CONVERSATION_RETENTION_DAYS, 90);
  const cutoff = getClosedConversationCutoff("2026-09-15T12:00:00.000Z");
  assert.equal(cutoff.toISOString(), "2026-06-17T12:00:00.000Z");
  assert.throws(() => getClosedConversationCutoff("not-a-date"), /清理时间无效/);
});
