import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppError } from "../../api/errors";
import { QueryState } from "../../admin/QueryState";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { PageHeader } from "../../components/ui/PageHeader";
import { listReceptionists } from "../../services/receptionistService";
import type { ReceptionistSummary } from "../../types/admin";

export function ReceptionistsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<ReceptionistSummary[]>([]);

  function load() {
    setLoading(true);
    setError("");
    listReceptionists()
      .then(setRows)
      .catch((reason: unknown) => setError(reason instanceof AppError ? reason.message : "Unable to load receptionists."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Receptionists"
        description="Front-desk accounts."
        actions={<Link className="inline-flex min-h-10 items-center rounded-md border border-primary-hover bg-primary-hover px-4 font-semibold text-white" to="/admin/receptionists/new">Add receptionist</Link>}
      />
      <QueryState loading={loading} error={error} onRetry={load}>
        {rows.length === 0 ? (
          <EmptyState title="No receptionists found" description="Add a receptionist to staff the front desk." />
        ) : (
          <div className="grid gap-3">
            {rows.map((row) => (
              <Link key={row.receptionist_id} to={`/admin/receptionists/${row.receptionist_id}`} className="block rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                <Card>
                  <p className="text-lg font-semibold text-ink">{row.name || "Unknown"}</p>
                  <p className="text-sm text-muted">{row.email}</p>
                  <p className="text-sm text-muted">{row.username}</p>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </QueryState>
    </div>
  );
}
