import type { SelectHTMLAttributes } from "react";
import { cn } from "../../lib/cn";
import { controlClass, focusClass } from "./fieldStyles";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  invalid?: boolean;
};

export function Select({ invalid = false, className, children, ...props }: SelectProps) {
  return (
    <select
      className={cn(controlClass, focusClass, invalid && "border-danger", className)}
      aria-invalid={invalid || undefined}
      {...props}
    >
      {children}
    </select>
  );
}
