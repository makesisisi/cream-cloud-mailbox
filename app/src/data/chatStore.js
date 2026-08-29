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
    aiAssistanceEnabled: true,
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
    aiAnalysis: {
      id: "analysis-demo-1",
      sourceMessageId: "msg-demo-1",
      status: "ready",
      primaryEmotion: "疲惫",
      secondaryEmotions: ["压力", "无力感"],
      intensity: 2,
      currentNeed: "先被理解，再一起缩小问题",
      observation: "对方提到工作与生活挤在一起，可能长期缺少真正休息。",
      suggestedOpening: "听起来你已经撑着处理很多事情一段时间了，能说出来很不容易。",
      followUpQuestions: ["最近哪一部分最让你喘不过气？"],
      avoidPhrases: ["大家都很累", "别想太多"],
      safetyLevel: "normal",
      safetyReasons: [],
      confidence: 0.76,
      model: "demo-preview",
      createdAt: "2026-08-27T10:16:10.000Z",
      updatedAt: "2026-08-27T10:16:10.000Z",
    },
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

export async function createConversation(session, { topic, need, aiConsent = false }) {
  if (authMode === "netlify") {
    const { conversation } = await apiRequest("", {
      method: "POST",
      body: JSON.stringify({ topic, need, aiConsent }),
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
    aiAssistanceEnabled: aiConsent,
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
    const messageId = crypto.randomUUID();
    return {
      ...conversation,
      status: sender === "admin" ? "active" : "waiting",
      updatedAt: now,
      messages: [
        ...conversation.messages,
        { id: messageId, sender, body: text, createdAt: now },
      ],
      ...(sender === "client" && conversation.aiAssistanceEnabled
        ? { aiAnalysis: createDemoAnalysis(text, messageId, now) }
        : {}),
    };
  });
  writeLocalConversations(conversations);
  return conversations.find((conversation) => conversation.id === conversationId) ?? null;
}

function createDemoAnalysis(body, sourceMessageId, now) {
  const urgent = /不想活|想死|自杀|伤害自己|自残|割腕|跳楼|吞药/u.test(body);
  const anxious = /焦虑|担心|害怕|紧张|睡不着/u.test(body);
  const angry = /生气|愤怒|气死|讨厌/u.test(body);
  const tired = /累|疲惫|撑不住|压力/u.test(body);
  const primaryEmotion = urgent ? "非常痛苦" : anxious ? "焦虑" : angry ? "愤怒" : tired ? "疲惫" : "需要进一步倾听";
  return {
    id: crypto.randomUUID(),
    sourceMessageId,
    status: "ready",
    primaryEmotion,
    secondaryEmotions: [],
    intensity: urgent ? 3 : 2,
    currentNeed: urgent ? "立即获得人工关注与安全确认" : "先被认真倾听",
    observation: "这是本地演示中的辅助提示，线上版本会使用服务端模型结合最近对话分析。",
    suggestedOpening: urgent
      ? "谢谢你告诉我这些。我很在意你现在的安全，我们先确认一下：你此刻是否正面临立即危险？"
      : "谢谢你愿意说出来。我在这里，我们可以慢慢聊。",
    followUpQuestions: urgent ? ["你现在身边有可以陪伴和帮助你的人吗？"] : ["此刻最想先让我听见的是哪一部分？"],
    avoidPhrases: ["别想太多", "你应该振作一点"],
    safetyLevel: urgent ? "urgent" : "normal",
    safetyReasons: urgent ? ["文本中出现需要立即人工复核的高风险表达"] : [],
    confidence: 0.5,
    model: "demo-preview",
    createdAt: now,
    updatedAt: now,
  };
}

export async function retryAiAnalysis(conversationId) {
  if (authMode === "netlify") {
    const { analysis } = await apiRequest(`/${conversationId}/analysis`, { method: "POST" });
    apiCache = apiCache.map((item) =>
      item.id === conversationId ? { ...item, aiAnalysis: analysis } : item,
    );
    notifyApiUpdated();
    return analysis;
  }

  const conversations = readLocalConversations();
  const conversation = conversations.find((item) => item.id === conversationId);
  const lastClientMessage = conversation?.messages.filter((message) => message.sender === "client").at(-1);
  if (!conversation?.aiAssistanceEnabled || !lastClientMessage) return null;
  const analysis = createDemoAnalysis(lastClientMessage.body, lastClientMessage.id, new Date().toISOString());
  writeLocalConversations(conversations.map((item) =>
    item.id === conversationId ? { ...item, aiAnalysis: analysis } : item,
  ));
  return analysis;
}

export async function setAiAssistance(conversationId, enabled) {
  if (authMode === "netlify") {
    const { conversation } = await apiRequest(`/${conversationId}/ai-consent`, {
      method: "POST",
      body: JSON.stringify({ enabled }),
    });
    apiCache = apiCache.map((item) => (item.id === conversation.id ? conversation : item));
    notifyApiUpdated();
    return conversation;
  }

  const conversations = readLocalConversations().map((conversation) =>
    conversation.id === conversationId
      ? { ...conversation, aiAssistanceEnabled: enabled, ...(!enabled ? { aiAnalysis: undefined } : {}) }
      : conversation,
  );
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
