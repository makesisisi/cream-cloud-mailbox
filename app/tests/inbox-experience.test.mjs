import assert from "node:assert/strict";
import test from "node:test";
import {
  getConversationUnreadCount,
  getLastReplyMeta,
  matchesConversationSearch,
  sortAdminConversations,
} from "../src/utils/inboxExperience.js";

function conversation(overrides = {}) {
  return {
    id: "conversation-a",
    alias: "云朵-047",
    topic: "最近总觉得很累",
    need: "希望有人听我说说",
    updatedAt: "2026-09-15T12:00:00.000Z",
    messages: [],
    adminState: { pinned: false, tags: [], lastReadAt: null },
    ...overrides,
  };
}

test("counts unread client messages after the administrator read marker", () => {
  const item = conversation({
    adminState: { pinned: false, tags: [], lastReadAt: "2026-09-15T11:00:00.000Z" },
    messages: [
      { sender: "client", createdAt: "2026-09-15T10:00:00.000Z" },
      { sender: "admin", createdAt: "2026-09-15T11:30:00.000Z" },
      { sender: "client", createdAt: "2026-09-15T12:00:00.000Z" },
      { sender: "client", createdAt: "2026-09-15T12:01:00.000Z", recalledAt: "2026-09-15T12:02:00.000Z" },
    ],
  });
  assert.equal(getConversationUnreadCount(item), 1);
});

test("searches anonymous alias, topic, need, and administrator tags", () => {
  const item = conversation({ adminState: { pinned: false, tags: ["学业压力"], lastReadAt: null } });
  assert.equal(matchesConversationSearch(item, "047"), true);
  assert.equal(matchesConversationSearch(item, "学业"), true);
  assert.equal(matchesConversationSearch(item, "人际"), false);
});

test("sorts pinned, risk, unread, then recent conversations", () => {
  const pinned = conversation({ id: "pinned", adminState: { pinned: true, tags: [], lastReadAt: null } });
  const urgent = conversation({ id: "urgent", aiAnalysis: { safetyLevel: "urgent" } });
  const unread = conversation({ id: "unread", messages: [{ sender: "client", createdAt: "2026-09-15T12:00:00.000Z" }] });
  const recent = conversation({ id: "recent", updatedAt: "2026-09-15T13:00:00.000Z", adminState: { pinned: false, tags: [], lastReadAt: "2026-09-15T13:00:00.000Z" } });
  assert.deepEqual(sortAdminConversations([recent, unread, urgent, pinned]).map((item) => item.id), ["pinned", "urgent", "unread", "recent"]);
});

test("reports who sent the latest non-system reply", () => {
  const item = conversation({ messages: [
    { sender: "system", createdAt: "2026-09-15T10:00:00.000Z" },
    { sender: "client", createdAt: "2026-09-15T11:00:00.000Z" },
    { sender: "admin", createdAt: "2026-09-15T12:00:00.000Z" },
  ] });
  assert.equal(getLastReplyMeta(item).label, "我回复");
});
