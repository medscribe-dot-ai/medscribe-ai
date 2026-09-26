import type { InputHTMLAttributes } from "react";
import { cn } from "../../lib/cn";
import { controlClass, focusClass } from "./fieldStyles";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
};

export function Input({ invalid = false, className, ...props }: InputProps) {
  return (
    <input
      className={cn(controlClass, focusClass, invalid && "border-danger", className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}
