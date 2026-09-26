import type { ReactNode } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { AppShell } from "./AppShell";
import { receptionistNav } from "./navigation";

export function ReceptionistLayout({ children }: { children?: ReactNode }) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  return (
    <AppShell
      title="Reception"
      roleLabel="Receptionist"
      navLabel="Reception"
      items={receptionistNav}
      onLogout={() => {
        logout();
        navigate("/login", { replace: true });
      }}
    >
      {children ?? <Outlet />}
    </AppShell>
  );
}
