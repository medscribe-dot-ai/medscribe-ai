import type { ReactNode } from "react";
import { Button } from "../components/ui/Button";
import { ErrorState } from "../components/ui/ErrorState";
import { Skeleton } from "../components/ui/Skeleton";

export function QueryState({
  loading,
  error,
  onRetry,
  children,
}: {
  loading: boolean;
  error: string;
  onRetry?: () => void;
  children: ReactNode;
}) {
  if (loading) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (error) {
    return (
      <ErrorState
        title="Unable to load this page"
        description={error}
        action={onRetry ? <Button variant="secondary" onClick={onRetry}>Retry</Button> : undefined}
      />
    );
  }
  return children;
}

export function statusLabel(status: string | null | undefined) {
  const key = (status || "").toLowerCase().trim();
  if (key === "waiting") return "Waiting";
  if (key === "in_progress") return "In progress";
  if (key === "scheduled") return "Scheduled";
  if (key === "completed") return "Completed";
  if (key === "cancelled") return "Cancelled";
  if (key === "assigned") return "Assigned";
  if (!key) return "Unknown";
  return key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}
