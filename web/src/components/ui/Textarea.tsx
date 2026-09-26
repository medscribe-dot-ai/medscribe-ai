import type { TextareaHTMLAttributes } from "react";
import { cn } from "../../lib/cn";
import { controlClass, focusClass } from "./fieldStyles";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean;
};

export function Textarea({ invalid = false, className, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(controlClass, "min-h-24 py-2", focusClass, invalid && "border-danger", className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}
