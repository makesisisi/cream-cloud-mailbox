import { useEffect, useRef, useState } from "react";

export function useConversationDraft(userId, role, conversationId) {
  const key = `cloudmail.draft:${userId}:${role}:${conversationId}`;
  const [drafts, setDrafts] = useState({});
  let stored = "";
  try { stored = sessionStorage.getItem(key) || ""; } catch { /* storage may be disabled */ }
  const value = drafts[key] ?? stored;
  function update(next) {
    const text = typeof next === "function" ? next(value) : next;
    setDrafts(current => ({ ...current, [key]: text }));
    try { if (text) sessionStorage.setItem(key, text); else sessionStorage.removeItem(key); } catch { /* retain in memory */ }
  }
  return [value, update];
}

export function useConversationScroll(id, count) {
  const ref = useRef(null);
  const bottom = useRef(true);
  const previous = useRef(null);
  const [unread, setUnread] = useState(false);
  function jump() {
    const box = ref.current;
    if (box) box.scrollTop = box.scrollHeight;
    bottom.current = true;
    setUnread(false);
  }
  useEffect(() => {
    if (previous.current !== id || bottom.current) jump();
    else setUnread(true);
    previous.current = id;
  }, [id, count]);
  function onScroll() {
    const box = ref.current;
    if (!box) return;
    bottom.current = box.scrollHeight - box.scrollTop - box.clientHeight < 90;
    if (bottom.current) setUnread(false);
  }
  return { ref, onScroll, unread, jump };
}
