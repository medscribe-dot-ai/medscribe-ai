import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";
import { focusClass } from "./fieldStyles";

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: ReactNode;
};

export function Checkbox({ label, id, className, ...props }: CheckboxProps) {
  return (
    <label htmlFor={id} className={cn("inline-flex min-h-10 items-center gap-3 text-base text-ink", className)}>
      <input id={id} type="checkbox" className={cn("size-5 accent-primary-hover", focusClass)} {...props} />
      <span>{label}</span>
    </label>
  );
}
