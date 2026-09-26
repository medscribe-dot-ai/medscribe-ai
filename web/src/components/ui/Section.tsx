import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";

type SectionProps = HTMLAttributes<HTMLElement> & {
  title: string;
  children: ReactNode;
};

export function Section({ title, children, className, ...props }: SectionProps) {
  return (
    <section className={cn("flex flex-col gap-3", className)} {...props}>
      <h2 className="text-xl font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}
