import { createContext, useContext } from "react";
import type { UserSession } from "./session";

export type AuthContextValue = {
  session: UserSession | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<UserSession>;
  logout: () => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
