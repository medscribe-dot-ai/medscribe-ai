import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export function HelperText({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("mt-1 text-sm text-muted", className)} {...props} />;
}
