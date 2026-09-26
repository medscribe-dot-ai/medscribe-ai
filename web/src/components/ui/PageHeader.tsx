import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
};

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-3 border-b border-line pb-4 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="break-words text-2xl font-semibold text-ink sm:text-3xl">{title}</h1>
        {description ? <p className="mt-1 text-base text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}
