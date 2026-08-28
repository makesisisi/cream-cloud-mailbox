import { useCallback, useEffect, useState } from "react";
import { authMode } from "../auth/authService.js";

const CHAT_KEY = "cloudmail.demo.conversations";
const CHAT_EVENT = "cloudmail:chat-updated";
const API_ROOT = "/api/conversations";

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

let apiCache = [];
let apiLoaded = false;
let activeRequest = null;

function readLocalConversations() {
  try {
    const stored = window.localStorage.getItem(CHAT_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    // Fall back to seeded local data.
  }
  window.localStorage.setItem(CHAT_KEY, JSON.stringify(seedConversations));
  return seedConversations;
}

function writeLocalConversations(conversations) {
  window.localStorage.setItem(CHAT_KEY, JSON.stringify(conversations));
  window.dispatchEvent(new CustomEvent(CHAT_EVENT));
}

async function apiRequest(path = "", options = {}) {
  const response = await fetch(`${API_ROOT}${path}`, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "对话服务暂时不可用，请稍后再试。");
  return payload;
}

async function loadApiConversations() {
  if (activeRequest) return activeRequest;
  activeRequest = apiRequest()
    .then(({ conversations }) => {
      apiCache = conversations;
      apiLoaded = true;
      return conversations;
    })
    .finally(() => {
      activeRequest = null;
    });
  return activeRequest;
}

function notifyApiUpdated() {
  window.dispatchEvent(new CustomEvent(CHAT_EVENT));
}

export function useConversations() {
  const [state, setState] = useState(() => ({
    conversations: authMode === "demo" ? readLocalConversations() : apiCache,
    loading: authMode === "netlify" && !apiLoaded,
    error: "",
  }));

  const refresh = useCallback(async () => {
    if (authMode === "demo") {
      setState({ conversations: readLocalConversations(), loading: false, error: "" });
      return;
    }
    try {
      const conversations = await loadApiConversations();
      setState({ conversations, loading: false, error: "" });
    } catch (reason) {
      setState((current) => ({
        ...current,
        loading: false,
        error: reason instanceof Error ? reason.message : "对话服务暂时不可用。",
      }));
    }
  }, []);

  useEffect(() => {
    let timer;
    const handleUpdate = () => refresh();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener(CHAT_EVENT, handleUpdate);
    window.addEventListener("storage", handleUpdate);
    document.addEventListener("visibilitychange", handleVisibility);
    refresh();
    if (authMode === "netlify") timer = window.setInterval(refresh, 10_000);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener(CHAT_EVENT, handleUpdate);
      window.removeEventListener("storage", handleUpdate);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [refresh]);

  return { ...state, refresh };
}

export async function createConversation(session, { topic, need }) {
  if (authMode === "netlify") {
    const { conversation } = await apiRequest("", {
      method: "POST",
      body: JSON.stringify({ topic, need }),
    });
    apiCache = [conversation, ...apiCache.filter((item) => item.id !== conversation.id)];
    apiLoaded = true;
    notifyApiUpdated();
    return conversation;
  }

  const conversations = readLocalConversations();
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
  writeLocalConversations([conversation, ...conversations]);
  return conversation;
}

export async function sendMessage(conversationId, sender, body) {
  const text = body.trim();
  if (!text) return null;
  if (authMode === "netlify") {
    const { conversation } = await apiRequest(`/${conversationId}/messages`, {
      method: "POST",
      body: JSON.stringify({ body: text }),
    });
    apiCache = apiCache.map((item) => (item.id === conversation.id ? conversation : item));
    notifyApiUpdated();
    return conversation;
  }

  const now = new Date().toISOString();
  const conversations = readLocalConversations().map((conversation) => {
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
  writeLocalConversations(conversations);
  return conversations.find((conversation) => conversation.id === conversationId) ?? null;
}

export async function closeConversation(conversationId) {
  if (authMode === "netlify") {
    const { conversation } = await apiRequest(`/${conversationId}/close`, { method: "POST" });
    apiCache = apiCache.map((item) => (item.id === conversation.id ? conversation : item));
    notifyApiUpdated();
    return conversation;
  }

  const conversations = readLocalConversations().map((conversation) =>
    conversation.id === conversationId
      ? { ...conversation, status: "closed", updatedAt: new Date().toISOString() }
      : conversation,
  );
  writeLocalConversations(conversations);
  return conversations.find((conversation) => conversation.id === conversationId) ?? null;
}
