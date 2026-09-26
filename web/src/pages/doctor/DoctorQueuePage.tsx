import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppError } from "../../api/errors";
import { QueryState } from "../../admin/QueryState";
import { useAuth } from "../../auth/useAuth";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { PageHeader } from "../../components/ui/PageHeader";
import { QueueToken } from "../../components/ui/QueueToken";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { useToast } from "../../components/ui/useToast";
import { recordPath, selectNextAppointmentId } from "../../doctor/queue";
import { clinicToday, formatAppointmentTime } from "../../lib/clinicTime";
import { listAppointmentsByDate, updateAppointmentStatus } from "../../services/appointmentService";
import type { AppointmentRow } from "../../types/admin";

export function DoctorQueuePage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const { push } = useToast();
  const inFlight = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [queue, setQueue] = useState<AppointmentRow[]>([]);
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
    listAppointmentsByDate(clinicToday(), doctorId)
      .then((rows) => setQueue(rows.filter((row) => ["waiting", "in_progress"].includes((row.status || "").toLowerCase()))))
      .catch((reason: unknown) => {
        setQueue([]);
        setError(reason instanceof AppError ? reason.message : "Could not load today's appointments.");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [session?.doctor_id]);

  const nextId = useMemo(() => selectNextAppointmentId(queue), [queue]);

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

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Patient queue" description="Waiting and in-progress visits for today." actions={<Button variant="secondary" onClick={load}>Refresh</Button>} />
      <QueryState loading={loading} error={error} onRetry={load}>
        {queue.length === 0 ? (
          <EmptyState title="No patients in queue" description="Waiting and in-progress visits for today will show here." />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {queue.map((item) => {
              const waiting = (item.status || "").toLowerCase() === "waiting";
              return (
                <Card key={item.appointment_id} className={item.appointment_id === nextId ? "border-primary bg-mint" : undefined}>
                  {item.appointment_id === nextId ? <p className="mb-2 text-sm font-semibold text-primary-hover">Next</p> : null}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      {item.queue_token ? <QueueToken token={item.queue_token} /> : <p className="text-sm text-muted">No token</p>}
                      <p className="mt-2 text-lg font-semibold">{item.patient_name || "Patient"}</p>
                      <p className="text-sm text-muted">{item.patient_code || "—"} · {formatAppointmentTime(item.scheduled_time)}</p>
                    </div>
                    <StatusBadge label={waiting ? "Waiting" : "In progress"} tone={waiting ? "warning" : "info"} />
                  </div>
                  <Button className="mt-4" loading={startingId === item.appointment_id} disabled={startingId !== null} onClick={() => void start(item)}>
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
