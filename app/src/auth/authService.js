import {
  acceptInvite as netlifyAcceptInvite,
  getUser as getNetlifyUser,
  handleAuthCallback,
  login as netlifyLogin,
  logout as netlifyLogout,
  requestPasswordRecovery as netlifyRequestPasswordRecovery,
  signup as netlifySignup,
  updateUser as netlifyUpdateUser,
} from "@netlify/identity";
import { isConfirmedIdentityUser } from "./identityState.js";

const SESSION_KEY = "cloudmail.demo.session";
const USERS_KEY = "cloudmail.demo.users";

export const authMode = import.meta.env.VITE_AUTH_MODE === "netlify" ? "netlify" : "demo";

const seededUsers = [
  {
    id: "demo-client",
    email: "user@cloudmail.local",
    password: "User123!",
    displayName: "来访者",
    role: "client",
    alias: "云朵-047",
  },
  {
    id: "demo-admin",
    email: "admin@cloudmail.local",
    password: "Admin123!",
    displayName: "倾听员小暖",
    role: "admin",
    alias: null,
  },
];

function readJson(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function saveUsers(users) {
  window.localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function ensureDemoUsers() {
  const stored = readJson(USERS_KEY, []);
  const merged = [...stored];
  for (const seed of seededUsers) {
    if (!merged.some((user) => user.email === seed.email)) merged.push(seed);
  }
  saveUsers(merged);
  return merged;
}

function safeSession(user) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    alias: user.alias,
    provider: "demo",
  };
}

function toNetlifySession(user) {
  const roles = user?.appMetadata?.roles ?? user?.app_metadata?.roles ?? [];
  return {
    id: user.id,
    email: user.email,
    displayName: user.userMetadata?.full_name ?? user.user_metadata?.full_name ?? "匿名来访者",
    role: roles.includes("admin") ? "admin" : "client",
    alias: "匿名来访者",
    provider: "netlify",
  };
}

export async function hydrateSession() {
  if (authMode === "netlify") {
    const callback = await handleAuthCallback();
    if (callback?.type === "invite") return { session: null, callback };
    if (callback?.type === "recovery") {
      return { session: callback.user ? toNetlifySession(callback.user) : null, callback };
    }
    const user = callback?.user ?? await getNetlifyUser();
    return { session: user ? toNetlifySession(user) : null, callback: null };
  }

  ensureDemoUsers();
  return { session: readJson(SESSION_KEY, null), callback: null };
}

export async function acceptInviteWithPassword(token, password) {
  if (authMode !== "netlify") throw new Error("本地演示模式不处理线上邀请。");
  const user = await netlifyAcceptInvite(token, password);
  return toNetlifySession(user);
}

export async function loginWithEmail(email, password) {
  if (authMode === "netlify") {
    const user = await netlifyLogin(email, password);
    return toNetlifySession(user);
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = ensureDemoUsers().find(
    (candidate) => candidate.email.toLowerCase() === normalizedEmail && candidate.password === password,
  );
  if (!user) throw new Error("邮箱或密码不正确，请检查后再试。");
  const session = safeSession(user);
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export async function registerWithEmail({ email, password, displayName }) {
  if (authMode === "netlify") {
    const user = await netlifySignup(email, password, {
      full_name: displayName || "匿名来访者",
    });
    const confirmed = isConfirmedIdentityUser(user);
    if (!confirmed) {
      try {
        const existingUser = await netlifyLogin(email, password);
        return { session: toNetlifySession(existingUser), needsConfirmation: false };
      } catch {
        // Identity intentionally returns an ambiguous signup response for an existing
        // address. If the supplied password does not log in, guide the visitor to login.
      }
    }
    return {
      session: confirmed ? toNetlifySession(user) : null,
      needsConfirmation: !confirmed,
    };
  }

  const normalizedEmail = email.trim().toLowerCase();
  const users = ensureDemoUsers();
  if (users.some((candidate) => candidate.email.toLowerCase() === normalizedEmail)) {
    throw new Error("这个邮箱已经注册，可以直接登录。");
  }
  const user = {
    id: crypto.randomUUID(),
    email: normalizedEmail,
    password,
    displayName: displayName.trim() || "匿名来访者",
    role: "client",
    alias: `云朵-${Math.floor(100 + Math.random() * 900)}`,
  };
  saveUsers([...users, user]);
  const session = safeSession(user);
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return { session, needsConfirmation: false };
}

export async function requestPasswordRecoveryEmail(email) {
  if (authMode === "netlify") {
    await netlifyRequestPasswordRecovery(email.trim().toLowerCase());
    return;
  }
  await new Promise((resolve) => window.setTimeout(resolve, 350));
}

export async function updateCurrentPassword(password) {
  if (authMode !== "netlify") throw new Error("本地演示模式不会修改真实密码。");
  const user = await netlifyUpdateUser({ password });
  return toNetlifySession(user);
}

export async function logoutSession() {
  if (authMode === "netlify") {
    await netlifyLogout();
    return;
  }
  window.localStorage.removeItem(SESSION_KEY);
}

export const demoAccounts = seededUsers.map(({ email, password, role }) => ({ email, password, role }));
