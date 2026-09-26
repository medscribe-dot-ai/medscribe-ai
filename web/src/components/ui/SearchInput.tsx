import type { InputHTMLAttributes } from "react";
import { HelperText } from "./HelperText";
import { Input } from "./Input";
import { Label } from "./Label";

type SearchInputProps = InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  hint?: string;
};

export function SearchInput({ id, label, hint, ...props }: SearchInputProps) {
  const hintId = hint ? `${id}-hint` : undefined;

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="search" aria-describedby={hintId} {...props} />
      {hint ? <HelperText id={hintId}>{hint}</HelperText> : null}
    </div>
  );
}
