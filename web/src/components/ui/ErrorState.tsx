import type { ReactNode } from "react";

type ErrorStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
};

export function ErrorState({ title, description, action }: ErrorStateProps) {
  return (
    <div role="alert" className="rounded-lg border border-danger/30 bg-surface px-4 py-8 text-center">
      <p className="text-lg font-semibold text-ink">{title}</p>
      {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
