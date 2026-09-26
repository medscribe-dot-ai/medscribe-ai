import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

type AlertProps = {
  title: string;
  children?: ReactNode;
  tone?: "info" | "success" | "warning" | "danger";
};

const tones: Record<NonNullable<AlertProps["tone"]>, string> = {
  info: "border-info/30 bg-surface text-ink",
  success: "border-success/30 bg-mint text-ink",
  warning: "border-warning/40 bg-surface text-ink",
  danger: "border-danger/30 bg-surface text-ink",
};

export function Alert({ title, children, tone = "info" }: AlertProps) {
  return (
    <div role="status" className={cn("rounded-lg border px-4 py-3", tones[tone])}>
      <p className="text-base font-semibold">{title}</p>
      {children ? <p className="mt-1 text-sm text-muted">{children}</p> : null}
    </div>
  );
}
