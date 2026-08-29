import assert from "node:assert/strict";
import test from "node:test";
import {
  formatConversationDate,
  getGreeting,
  getMessagePerspectiveClass,
  groupMessagesByDate,
} from "../src/utils/presentation.js";

test("uses a time-appropriate greeting instead of a fixed evening greeting", () => {
  assert.equal(getGreeting(new Date(2026, 0, 1, 8)), "早上好");
  assert.equal(getGreeting(new Date(2026, 0, 1, 15)), "下午好");
  assert.equal(getGreeting(new Date(2026, 0, 1, 21)), "晚上好");
});

test("aligns messages by the current viewer rather than by a fixed sender role", () => {
  assert.equal(getMessagePerspectiveClass("client", "client"), "message-own");
  assert.equal(getMessagePerspectiveClass("admin", "client"), "message-other");
  assert.equal(getMessagePerspectiveClass("admin", "admin"), "message-own");
  assert.equal(getMessagePerspectiveClass("client", "admin"), "message-other");
  assert.equal(getMessagePerspectiveClass("system", "admin"), "message-system");
});

test("labels current and previous conversation dates naturally", () => {
  const now = new Date(2026, 0, 2, 12);
  assert.equal(formatConversationDate(new Date(2026, 0, 2, 8), now), "今天");
  assert.equal(formatConversationDate(new Date(2026, 0, 1, 23), now), "昨天");
});

test("groups messages by calendar date while preserving message order", () => {
  const groups = groupMessagesByDate([
    { id: "1", createdAt: "2026-01-01T09:00:00+08:00" },
    { id: "2", createdAt: "2026-01-01T10:00:00+08:00" },
    { id: "3", createdAt: "2026-01-02T08:00:00+08:00" },
  ]);

  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0].messages.map((message) => message.id), ["1", "2"]);
  assert.deepEqual(groups[1].messages.map((message) => message.id), ["3"]);
});
