import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AppError } from "../../api/errors";
import { QueryState } from "../../admin/QueryState";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Dialog } from "../../components/ui/Dialog";
import { PageHeader } from "../../components/ui/PageHeader";
import { deleteReceptionist, getReceptionist } from "../../services/receptionistService";
import type { ReceptionistDetail } from "../../types/admin";

export function ReceptionistDetailPage() {
  const { receptionistId } = useParams();
  const navigate = useNavigate();
  const [row, setRow] = useState<ReceptionistDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function load() {
    const id = Number(receptionistId);
    if (!Number.isInteger(id)) {
      setError("Receptionist not found.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    getReceptionist(id)
      .then(setRow)
      .catch((reason: unknown) => setError(reason instanceof AppError ? reason.message : "Unable to load this receptionist."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [receptionistId]);

  async function remove() {
    if (!row || deleting) return;
    setDeleting(true);
    try {
      await deleteReceptionist(row.receptionist_id);
      navigate("/admin/receptionists", { replace: true });
    } catch (reason: unknown) {
      setError(reason instanceof AppError ? reason.message : "Unable to delete this receptionist.");
      setConfirming(false);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <QueryState loading={loading} error={error} onRetry={load}>
        {row ? (
          <>
            <PageHeader
              title={row.name}
              description="Receptionist account"
              actions={
                <>
                  <Link className="inline-flex min-h-10 items-center rounded-md border border-line bg-surface px-4 font-semibold" to={`/admin/receptionists/${row.receptionist_id}/edit`}>Edit</Link>
                  <Button variant="danger" onClick={() => setConfirming(true)}>Delete</Button>
                </>
              }
            />
            <Card>
              <dl className="grid gap-3 sm:grid-cols-2">
                <div><dt className="text-sm text-muted">Username</dt><dd className="font-semibold">{row.username}</dd></div>
                <div><dt className="text-sm text-muted">Email</dt><dd className="font-semibold">{row.email}</dd></div>
                <div><dt className="text-sm text-muted">Phone</dt><dd className="font-semibold">{row.phone || "—"}</dd></div>
              </dl>
            </Card>
          </>
        ) : null}
      </QueryState>
      <Dialog open={confirming} title="Delete this receptionist?" onClose={() => setConfirming(false)}>
        <p>This permanently removes the receptionist account.</p>
        <div className="mt-4"><Button variant="danger" loading={deleting} onClick={remove}>Delete receptionist</Button></div>
      </Dialog>
    </div>
  );
}
