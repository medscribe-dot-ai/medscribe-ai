import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/cn";
import { focusClass } from "./fieldStyles";
import { Spinner } from "./Spinner";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
};

const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "border-primary-hover bg-primary-hover text-white hover:bg-primary-active",
  secondary: "border-line bg-surface text-ink hover:bg-mint",
  ghost: "border-transparent bg-transparent text-ink hover:bg-accent",
  danger: "border-danger bg-danger text-white hover:bg-ink",
};

export function Button({
  variant = "primary",
  loading = false,
  className,
  children,
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-md border px-4 text-base font-semibold",
        focusClass,
        variants[variant],
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <span aria-hidden="true">
          <Spinner labelled={false} />
        </span>
      ) : null}
      {children}
    </button>
  );
}
