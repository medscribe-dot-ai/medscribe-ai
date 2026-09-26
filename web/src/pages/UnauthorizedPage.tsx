import { Link, useNavigate } from "react-router-dom";
import { roleHome } from "../auth/roles";
import { useAuth } from "../auth/useAuth";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { AuthLayout } from "../layouts/AuthLayout";

export function UnauthorizedPage() {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const home = session ? roleHome(session.role) : null;

  return (
    <AuthLayout>
      <Card className="mx-auto w-full max-w-md text-center">
        <h1 className="text-3xl font-semibold text-ink">Not available</h1>
        <p className="mt-2 text-base text-muted">This account cannot open that area.</p>
        <div className="mt-6 flex flex-col gap-2">
          {home ? (
            <Link
              to={home}
              className="inline-flex min-h-10 items-center justify-center rounded-md border border-primary-hover bg-primary-hover px-4 text-base font-semibold text-white"
            >
              Go to your area
            </Link>
          ) : null}
          {session ? (
            <Button
              variant="secondary"
              onClick={() => {
                logout();
                navigate("/login", { replace: true });
              }}
            >
              Log out
            </Button>
          ) : (
            <Link
              to="/login"
              className="inline-flex min-h-10 items-center justify-center rounded-md border border-line bg-surface px-4 text-base font-semibold text-ink"
            >
              Sign in
            </Link>
          )}
        </div>
      </Card>
    </AuthLayout>
  );
}
