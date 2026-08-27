import { useEffect, useState } from "react";

const CHAT_KEY = "cloudmail.demo.conversations";
const CHAT_EVENT = "cloudmail:chat-updated";

const seedConversations = [
  {
    id: "conv-demo-1",
    clientId: "demo-client",
    alias: "云朵-047",
    topic: "最近总觉得很累",
    need: "希望有人先听我说说",
    status: "waiting",
    updatedAt: "2026-08-27T10:18:00.000Z",
    messages: [
      {
        id: "msg-demo-1",
        sender: "client",
        body: "最近工作和生活都挤在一起，好像一直没有真正休息过。",
        createdAt: "2026-08-27T10:16:00.000Z",
      },
      {
        id: "msg-demo-2",
        sender: "admin",
        body: "谢谢你愿意把这些说出来。我在这里，我们可以慢慢来。最近最让你喘不过气的，是哪一部分呢？",
        createdAt: "2026-08-27T10:18:00.000Z",
      },
    ],
  },
];

function readConversations() {
  try {
    const stored = window.localStorage.getItem(CHAT_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    // Fall back to seeded local data.
  }
  window.localStorage.setItem(CHAT_KEY, JSON.stringify(seedConversations));
  return seedConversations;
}

function writeConversations(conversations) {
  window.localStorage.setItem(CHAT_KEY, JSON.stringify(conversations));
  window.dispatchEvent(new CustomEvent(CHAT_EVENT));
}

export function useConversations() {
  const [conversations, setConversations] = useState(() => readConversations());

  useEffect(() => {
    const refresh = () => setConversations(readConversations());
    window.addEventListener(CHAT_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(CHAT_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return conversations;
}

export function createConversation(session, { topic, need }) {
  const conversations = readConversations();
  const active = conversations.find(
    (conversation) => conversation.clientId === session.id && conversation.status !== "closed",
  );
  if (active) return active;

  const now = new Date().toISOString();
  const conversation = {
    id: crypto.randomUUID(),
    clientId: session.id,
    alias: session.alias,
    topic,
    need,
    status: "waiting",
    updatedAt: now,
    messages: [
      {
        id: crypto.randomUUID(),
        sender: "system",
        body: "会话已经创建。倾听员上线后会尽快回应，你可以从任何地方开始说。",
        createdAt: now,
      },
    ],
  };
  writeConversations([conversation, ...conversations]);
  return conversation;
}

export function sendMessage(conversationId, sender, body) {
  const text = body.trim();
  if (!text) return;
  const now = new Date().toISOString();
  const conversations = readConversations().map((conversation) => {
    if (conversation.id !== conversationId) return conversation;
    return {
      ...conversation,
      status: sender === "admin" ? "active" : "waiting",
      updatedAt: now,
      messages: [
        ...conversation.messages,
        { id: crypto.randomUUID(), sender, body: text, createdAt: now },
      ],
    };
  });
  writeConversations(conversations);
}

export function closeConversation(conversationId) {
  const conversations = readConversations().map((conversation) =>
    conversation.id === conversationId
      ? { ...conversation, status: "closed", updatedAt: new Date().toISOString() }
      : conversation,
  );
  writeConversations(conversations);
}
