import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  authMode,
  hydrateSession,
  loginWithEmail,
  logoutSession,
  registerWithEmail,
} from "./authService.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    hydrateSession()
      .then((value) => active && setSession(value))
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
      async logout() {
        await logoutSession();
        setSession(null);
      },
    }),
    [loading, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
