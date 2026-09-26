import type { ReactNode } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { AppShell } from "./AppShell";
import { adminNav } from "./navigation";

export function AdminLayout({ children }: { children?: ReactNode }) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  return (
    <AppShell
      title="Admin"
      roleLabel="Admin"
      navLabel="Admin"
      items={adminNav}
      onLogout={() => {
        logout();
        navigate("/login", { replace: true });
      }}
    >
      {children ?? <Outlet />}
    </AppShell>
  );
}
