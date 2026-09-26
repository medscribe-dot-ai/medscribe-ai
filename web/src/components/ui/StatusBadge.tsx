import { cn } from "../../lib/cn";

type StatusBadgeProps = {
  label: string;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
};

const tones: Record<NonNullable<StatusBadgeProps["tone"]>, string> = {
  neutral: "border-line bg-background text-ink",
  success: "border-success/30 bg-mint text-success",
  warning: "border-warning/40 bg-background text-[#92400E]",
  danger: "border-danger/30 bg-surface text-danger",
  info: "border-info/30 bg-surface text-info",
};

export function StatusBadge({ label, tone = "neutral" }: StatusBadgeProps) {
  return (
    <span className={cn("inline-flex min-h-8 items-center rounded-md border px-2 text-sm font-semibold", tones[tone])}>
      {label}
    </span>
  );
}
