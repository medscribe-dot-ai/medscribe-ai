import { Card } from "./Card";

type KpiCardProps = {
  label: string;
  value: string;
  hint?: string;
};

export function KpiCard({ label, value, hint }: KpiCardProps) {
  return (
    <Card>
      <p className="text-sm font-semibold text-muted">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-ink">{value}</p>
      {hint ? <p className="mt-1 text-sm text-muted">{hint}</p> : null}
    </Card>
  );
}
