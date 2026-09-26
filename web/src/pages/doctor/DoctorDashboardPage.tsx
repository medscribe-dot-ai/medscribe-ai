import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AppError } from "../../api/errors";
import { QueryState, statusLabel } from "../../admin/QueryState";
import { useAuth } from "../../auth/useAuth";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { KpiCard } from "../../components/ui/KpiCard";
import { PageHeader } from "../../components/ui/PageHeader";
import { QueueToken } from "../../components/ui/QueueToken";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { useToast } from "../../components/ui/useToast";
import { recordPath, selectNextAppointmentId } from "../../doctor/queue";
import { clinicToday, formatAppointmentTime } from "../../lib/clinicTime";
import { listAppointmentsByDate, updateAppointmentStatus } from "../../services/appointmentService";
import type { AppointmentRow } from "../../types/admin";

export function DoctorDashboardPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const { push } = useToast();
  const inFlight = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [queue, setQueue] = useState<AppointmentRow[]>([]);
  const [completedToday, setCompletedToday] = useState(0);
  const [startingId, setStartingId] = useState<number | null>(null);

  function load() {
    const doctorId = session?.doctor_id;
    if (doctorId == null) {
      setError("This session has no doctor id.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    const today = clinicToday();
    listAppointmentsByDate(today, doctorId)
      .then((rows) => {
        setQueue(rows.filter((row) => ["waiting", "in_progress"].includes((row.status || "").toLowerCase())));
        setCompletedToday(rows.filter((row) => (row.status || "").toLowerCase() === "completed").length);
      })
      .catch((reason: unknown) => {
        setQueue([]);
        setCompletedToday(0);
        setError(reason instanceof AppError ? reason.message : "Unable to load your dashboard. Please try again.");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [session?.doctor_id]);

  const nextId = useMemo(() => selectNextAppointmentId(queue), [queue]);
  const preview = useMemo(() => {
    const next = queue.find((item) => item.appointment_id === nextId);
    const rest = queue.filter((item) => item.appointment_id !== nextId);
    return (next ? [next, ...rest] : rest).slice(0, 3);
  }, [queue, nextId]);

  async function start(item: AppointmentRow) {
    if (inFlight.current) return;
    inFlight.current = true;
    setStartingId(item.appointment_id);
    try {
      if ((item.status || "").toLowerCase() === "waiting") {
        await updateAppointmentStatus(item.appointment_id, "in_progress");
      }
      navigate(recordPath(item));
    } catch (reason: unknown) {
      push(reason instanceof AppError ? reason.message : "Could not start consultation.", "danger");
    } finally {
      inFlight.current = false;
      setStartingId(null);
    }
  }

  const firstName = session?.name.split(" ")[0] || "Doctor";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`Salam, ${firstName}`} description="Today's queue for your clinic day." />
      <QueryState loading={loading} error={error} onRetry={load}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link to="/doctor/queue" className="block rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            <KpiCard label="In Queue" value={String(queue.length)} hint="Waiting and in progress" />
          </Link>
          <KpiCard label="Completed" value={String(completedToday)} hint="Today" />
        </div>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Patient queue</h2>
          <Link to="/doctor/queue" className="text-sm font-semibold text-primary-hover">View all</Link>
        </div>
        {preview.length === 0 ? (
          <EmptyState title="No patients in queue" description="New waiting patients will appear here." />
        ) : (
          <div className="grid gap-3">
            {preview.map((item) => {
              const waiting = (item.status || "").toLowerCase() === "waiting";
              return (
                <Card key={item.appointment_id} className={item.appointment_id === nextId ? "border-primary bg-mint" : undefined}>
                  {item.appointment_id === nextId ? <p className="mb-2 text-sm font-semibold text-primary-hover">Next</p> : null}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      {item.queue_token ? <QueueToken token={item.queue_token} /> : <p className="text-sm text-muted">No token</p>}
                      <p className="mt-2 text-lg font-semibold">{item.patient_name || "Patient"}</p>
                      <p className="text-sm text-muted">{item.patient_code || "—"} · {formatAppointmentTime(item.scheduled_time)} · {statusLabel(item.status)}</p>
                    </div>
                    <StatusBadge label={statusLabel(item.status)} tone={waiting ? "warning" : "info"} />
                  </div>
                  <Button className="mt-3" loading={startingId === item.appointment_id} disabled={startingId !== null} onClick={() => void start(item)}>
                    {waiting ? "Start consultation" : "Continue consultation"}
                  </Button>
                </Card>
              );
            })}
          </div>
        )}
      </QueryState>
    </div>
  );
}
