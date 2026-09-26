import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { AppError } from "../api/errors";
import { roleHome } from "../auth/roles";
import { useAuth } from "../auth/useAuth";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { FieldError } from "../components/ui/FieldError";
import { Input } from "../components/ui/Input";
import { Label } from "../components/ui/Label";
import { Spinner } from "../components/ui/Spinner";
import { AuthLayout } from "../layouts/AuthLayout";
import { BrandLogo } from "../components/BrandLogo";

function destinationAfterLogin(role: string, state: unknown) {
  const home = roleHome(role) ?? "/unauthorized";
  const from = state && typeof state === "object" && "from" in state ? state.from : null;
  if (!from || typeof from !== "object") return home;
  const pathname = "pathname" in from && typeof from.pathname === "string" ? from.pathname : "";
  const search = "search" in from && typeof from.search === "string" ? from.search : "";
  if (home !== "/unauthorized" && (pathname === home || pathname.startsWith(`${home}/`))) {
    return `${pathname}${search}`;
  }
  return home;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-zA-Z0-9_@.-]{3,100}$/;
const MIN_PASSWORD_LENGTH = 6;

export function LoginPage() {
  const { session, ready, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ identifier?: string; password?: string }>({});

  if (!ready) {
    return (
      <AuthLayout>
        <Spinner label="Loading session" />
      </AuthLayout>
    );
  }

  if (session) {
    return <Navigate to={roleHome(session.role) ?? "/unauthorized"} replace />;
  }

  function validate() {
    const next: { identifier?: string; password?: string } = {};
    const trimmed = identifier.trim();
    if (!trimmed) {
      next.identifier = "Email or username is required.";
    } else if (!EMAIL_REGEX.test(trimmed) && !USERNAME_REGEX.test(trimmed)) {
      next.identifier = "Enter a valid email address or username.";
    }
    if (!password.trim()) {
      next.password = "Password is required.";
    } else if (password.length < MIN_PASSWORD_LENGTH) {
      next.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    }
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting || !validate()) {
      return;
    }
    setSubmitting(true);
    setFormError("");
    try {
      const next = await login(identifier.trim(), password);
      navigate(destinationAfterLogin(next.role, location.state), { replace: true });
    } catch (error) {
      setFormError(error instanceof AppError ? error.message : "Unable to sign in. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <Card className="mx-auto w-full max-w-md px-6 py-8 sm:px-8">
        <div className="flex flex-col items-center text-center">
          <BrandLogo />
          <h1 className="mt-2 text-3xl font-semibold text-ink">Sign in</h1>
          <p className="mt-1 max-w-xs text-base text-muted">Use the same account as the clinic app.</p>
        </div>
        {formError ? (
          <div className="mt-4">
            <Alert title="Unable to sign in" tone="danger">
              {formError}
            </Alert>
          </div>
        ) : null}
        <form className="mt-6 flex w-full flex-col gap-4 text-left" onSubmit={onSubmit} noValidate>
          <div>
            <Label htmlFor="identifier">Email or username</Label>
            <Input
              id="identifier"
              name="username"
              autoComplete="username"
              value={identifier}
              invalid={Boolean(fieldErrors.identifier)}
              aria-describedby={fieldErrors.identifier ? "identifier-error" : undefined}
              onChange={(event) => setIdentifier(event.target.value)}
            />
            {fieldErrors.identifier ? <FieldError id="identifier-error">{fieldErrors.identifier}</FieldError> : null}
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              invalid={Boolean(fieldErrors.password)}
              aria-describedby={fieldErrors.password ? "password-error" : undefined}
              onChange={(event) => setPassword(event.target.value)}
            />
            {fieldErrors.password ? <FieldError id="password-error">{fieldErrors.password}</FieldError> : null}
            <Button variant="ghost" className="mt-1 min-h-0 self-start px-0 py-1 text-sm text-primary-hover" aria-pressed={showPassword} onClick={() => setShowPassword((value) => !value)}>
              {showPassword ? "Hide password" : "Show password"}
            </Button>
          </div>
          <Button type="submit" loading={submitting} className="w-full">
            Sign in
          </Button>
        </form>
      </Card>
    </AuthLayout>
  );
}
