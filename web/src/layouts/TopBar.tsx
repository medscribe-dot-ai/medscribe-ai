import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { IconButton } from "../components/ui/IconButton";

type TopBarProps = {
  title: string;
  roleLabel: string;
  onOpenNav: () => void;
  onLogout?: () => void;
};

export function TopBar({ title, roleLabel, onOpenNav, onLogout }: TopBarProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface">
      <div className="flex min-h-16 flex-wrap items-center gap-3 px-4 py-2 sm:px-6">
        <IconButton label="Open navigation" className="lg:hidden" onClick={onOpenNav}>
          <span aria-hidden="true" className="text-lg leading-none">
            ☰
          </span>
        </IconButton>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">MedScribeAI</p>
          <p className="truncate text-lg font-semibold leading-tight text-ink">{title}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2 border-l border-line pl-3">
          <Badge tone="mint">{roleLabel}</Badge>
          {onLogout ? (
            <Button variant="secondary" onClick={onLogout}>
              Log out
            </Button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
