import { useMemo, useState, type ReactNode } from "react";
import { login as loginRequest } from "../services/authService";
import { AuthContext, type AuthContextValue } from "./useAuth";
import { clearSession, readSession, writeSession, type UserSession } from "./session";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<UserSession | null>(() => readSession());

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      ready: true,
      async login(email, password) {
        const next = await loginRequest(email, password);
        writeSession(next);
        setSession(next);
        return next;
      },
      logout() {
        clearSession();
        setSession(null);
      },
    }),
    [session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
