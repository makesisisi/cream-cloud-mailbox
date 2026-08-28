import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  acceptInviteWithPassword,
  authMode,
  hydrateSession,
  loginWithEmail,
  logoutSession,
  registerWithEmail,
  requestPasswordRecoveryEmail,
  updateCurrentPassword,
} from "./authService.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [authCallback, setAuthCallback] = useState(null);
  const [authError, setAuthError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    hydrateSession()
      .then((result) => {
        if (!active) return;
        setSession(result.session);
        setAuthCallback(result.callback);
      })
      .catch((reason) => {
        if (active) setAuthError(reason instanceof Error ? reason.message : "邀请链接无法处理，请重新打开邮件中的链接。");
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo(
    () => ({
      session,
      loading,
      authMode,
      authCallback,
      authError,
      clearAuthError() {
        setAuthError("");
      },
      clearAuthCallback() {
        setAuthCallback(null);
      },
      async completeInvite(token, password) {
        const next = await acceptInviteWithPassword(token, password);
        setSession(next);
        setAuthCallback(null);
        return next;
      },
      async login(email, password) {
        const next = await loginWithEmail(email, password);
        setSession(next);
        return next;
      },
      async register(payload) {
        const result = await registerWithEmail(payload);
        if (result.session) setSession(result.session);
        return result;
      },
      async requestPasswordRecovery(email) {
        await requestPasswordRecoveryEmail(email);
      },
      async completePasswordRecovery(password) {
        const next = await updateCurrentPassword(password);
        setSession(next);
        setAuthCallback(null);
        return next;
      },
      async logout() {
        await logoutSession();
        setSession(null);
      },
    }),
    [authCallback, authError, loading, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
