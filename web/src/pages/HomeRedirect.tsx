import { Navigate } from "react-router-dom";
import { roleHome } from "../auth/roles";
import { useAuth } from "../auth/useAuth";
import { Spinner } from "../components/ui/Spinner";

export function HomeRedirect() {
  const { session, ready } = useAuth();

  if (!ready) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Spinner label="Loading session" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={roleHome(session.role) ?? "/unauthorized"} replace />;
}
