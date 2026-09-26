import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";
import { focusClass } from "./fieldStyles";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  children: ReactNode;
};

export function IconButton({ label, className, type = "button", children, ...props }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      className={cn(
        "inline-flex min-h-10 min-w-10 items-center justify-center rounded-md border border-line bg-surface text-ink hover:bg-mint",
        focusClass,
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
