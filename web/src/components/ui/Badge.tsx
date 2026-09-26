import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "mint" | "info";
};

const tones: Record<NonNullable<BadgeProps["tone"]>, string> = {
  neutral: "bg-background text-ink",
  mint: "bg-mint text-primary-hover",
  info: "bg-accent text-info",
};

export function Badge({ tone = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex min-h-8 items-center rounded-md border border-line px-2 text-sm font-semibold",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
