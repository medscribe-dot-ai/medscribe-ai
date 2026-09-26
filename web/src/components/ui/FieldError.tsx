import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export function FieldError({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p role="alert" className={cn("mt-1 text-sm font-semibold text-danger", className)} {...props} />;
}
