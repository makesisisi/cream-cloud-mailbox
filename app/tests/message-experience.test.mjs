import assert from "node:assert/strict";
import test from "node:test";
import {
  canRecallMessage,
  createReplySnapshot,
  getReplySummary,
  MESSAGE_RECALL_WINDOW_MS,
} from "../src/utils/messageExperience.js";

const now = Date.parse("2026-09-15T12:00:00.000Z");

test("only the original sender can recall a message within two minutes", () => {
  const message = { id: "m1", sender: "client", body: "hello", createdAt: new Date(now - 30_000).toISOString() };
  assert.equal(canRecallMessage(message, "client", now), true);
  assert.equal(canRecallMessage(message, "admin", now), false);
  assert.equal(canRecallMessage({ ...message, sender: "system" }, "system", now), false);
  assert.equal(canRecallMessage({ ...message, recalledAt: new Date(now).toISOString() }, "client", now), false);
  assert.equal(canRecallMessage({ ...message, createdAt: new Date(now - MESSAGE_RECALL_WINDOW_MS - 1).toISOString() }, "client", now), false);
});

test("reply snapshots remain useful for text, images, and recalled messages", () => {
  assert.deepEqual(createReplySnapshot({ id: "m1", sender: "admin", body: "收到", attachments: [] }), {
    id: "m1", sender: "admin", body: "收到", hasImage: false, recalledAt: undefined,
  });
  assert.equal(getReplySummary({ body: "", hasImage: true }), "[图片]");
  assert.equal(getReplySummary({ body: "secret", recalledAt: "2026-09-15T12:00:00.000Z" }), "原消息已撤回");
});
