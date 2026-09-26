import { useCallback, useMemo, useState, useEffect } from "react";
import { AppError } from "../../api/errors";
import { QueryState, statusLabel } from "../../admin/QueryState";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Dialog } from "../../components/ui/Dialog";
import { EmptyState } from "../../components/ui/EmptyState";
import { PageHeader } from "../../components/ui/PageHeader";
import { QueueToken } from "../../components/ui/QueueToken";
import { SearchInput } from "../../components/ui/SearchInput";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { useToast } from "../../components/ui/useToast";
import { clinicToday, formatAppointmentTime, parseAppointmentInstant } from "../../lib/clinicTime";
import { printQueueToken } from "../../lib/printQueueToken";
import { listAppointmentsByDate, updateAppointmentStatus } from "../../services/appointmentService";
import type { AppointmentRow } from "../../types/admin";

const QUEUE_STATUSES = new Set(["waiting", "in_progress", "completed"]);
const TABS = [
  { id: "waiting", label: "Waiting" },
  { id: "in_progress", label: "In Progress" },
  { id: "completed", label: "Done" },
  { id: "all", label: "All" },
] as const;

function toneFor(status: string) {
  if (status === "in_progress") return "info" as const;
  if (status === "completed") return "success" as const;
  return "warning" as const;
}

export function ReceptionQueuePage() {
  const { push } = useToast();
  const [rows, setRows] = useState<AppointmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("waiting");
  const [cancelId, setCancelId] = useState<number | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [loadedAt, setLoadedAt] = useState(() => Date.now());

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    listAppointmentsByDate(clinicToday())
      .then((items) => setRows(items.filter((item) => QUEUE_STATUSES.has((item.status || "").toLowerCase()))))
      .catch((reason: unknown) => {
        setRows([]);
        setError(reason instanceof AppError ? reason.message : "Unable to load today's queue.");
      })
      .finally(() => {
      setLoadedAt(Date.now());
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const waitingCount = rows.filter((row) => (row.status || "").toLowerCase() === "waiting").length;
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      const status = (row.status || "").toLowerCase();
      const matchesTab = tab === "all" || status === tab;
      const matchesQuery = !q || [row.patient_name, row.patient_code, row.queue_token, row.doctor_name].some((value) => (value || "").toLowerCase().includes(q));
      return matchesTab && matchesQuery;
    });
  }, [rows, query, tab]);

  async function cancel(appointmentId: number) {
    setUpdatingId(appointmentId);
    try {
      await updateAppointmentStatus(appointmentId, "cancelled");
      push("Appointment cancelled.", "success");
      setCancelId(null);
      load();
    } catch (reason: unknown) {
      push(reason instanceof AppError ? reason.message : "Could not update status.", "danger");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Patient queue" description={`${waitingCount} waiting`} actions={<Button variant="secondary" onClick={load}>Refresh</Button>} />
      <SearchInput id="queue-search" label="Search queue" hint="Token, name, code, or doctor." value={query} onChange={(event) => setQuery(event.target.value)} />
      <div role="tablist" aria-label="Queue status" className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} className={`min-h-10 rounded-md border px-4 text-sm font-semibold ${tab === item.id ? "border-primary-hover bg-mint text-primary-hover" : "border-line bg-surface"}`} onClick={() => setTab(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      <QueryState loading={loading && rows.length === 0} error={error} onRetry={load}>
        {visible.length === 0 ? (
          <EmptyState title="No patients in this section" />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {visible.map((row) => {
              const status = (row.status || "").toLowerCase();
              const instant = parseAppointmentInstant(row.scheduled_time || row.created_at);
              const waitMins = instant ? Math.max(0, Math.floor((loadedAt - instant.getTime()) / 60000)) : null;
              return (
                <Card key={row.appointment_id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      {row.queue_token ? <QueueToken token={row.queue_token} /> : <p className="text-sm text-muted">No token</p>}
                      <p className="mt-2 text-lg font-semibold">{row.patient_name || "Patient"}</p>
                      <p className="text-sm text-muted">{row.patient_code || "—"} · {formatAppointmentTime(row.scheduled_time)}</p>
                      <p className="text-sm text-muted">Doctor: {row.doctor_name?.trim() || "—"}</p>
                    </div>
                    <div className="text-right">
                      <StatusBadge label={status === "completed" ? "Done" : statusLabel(status)} tone={toneFor(status)} />
                      {status === "waiting" && waitMins !== null ? <p className="mt-1 text-sm text-muted">{waitMins} min wait</p> : null}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                    {row.queue_token ? (
                      <Button variant="secondary" onClick={() => {
                        const message = printQueueToken(row);
                        if (message) push(message, "warning");
                      }}>Print token</Button>
                    ) : null}
                    {status === "waiting" || status === "in_progress" ? (
                      <Button variant="secondary" loading={updatingId === row.appointment_id} onClick={() => setCancelId(row.appointment_id)}>Cancel</Button>
                    ) : null}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </QueryState>
      <Dialog open={cancelId != null} title="Cancel visit?" onClose={() => setCancelId(null)}>
        <p>This appointment will be cancelled.</p>
        <div className="mt-3">
          <Button variant="danger" loading={updatingId != null} onClick={() => cancelId != null && void cancel(cancelId)}>Cancel visit</Button>
        </div>
      </Dialog>
    </div>
  );
}
