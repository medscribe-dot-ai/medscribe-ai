import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Spinner } from "../components/ui/Spinner";
import { useAuth } from "./useAuth";

export function RequireAuth() {
  const { session, ready } = useAuth();
  const location = useLocation();

  if (!ready) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Spinner label="Loading session" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

export function RequireRole({ roles }: { roles: string[] }) {
  const { session } = useAuth();

  if (!session || !roles.includes(session.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
}
