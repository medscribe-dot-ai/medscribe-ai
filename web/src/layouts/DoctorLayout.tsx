import type { ReactNode } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { AppShell } from "./AppShell";
import { doctorNav } from "./navigation";

export function DoctorLayout({ children }: { children?: ReactNode }) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  return (
    <AppShell
      title="Doctor"
      roleLabel="Doctor"
      navLabel="Doctor"
      items={doctorNav}
      onLogout={() => {
        logout();
        navigate("/login", { replace: true });
      }}
    >
      {children ?? <Outlet />}
    </AppShell>
  );
}
