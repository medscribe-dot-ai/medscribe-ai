import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppError } from "../../api/errors";
import { QueryState, statusLabel } from "../../admin/QueryState";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { PageHeader } from "../../components/ui/PageHeader";
import { QueueToken } from "../../components/ui/QueueToken";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { useToast } from "../../components/ui/useToast";
import { clinicToday, formatAppointmentTime, formatClinicDateLabel } from "../../lib/clinicTime";
import { printQueueToken } from "../../lib/printQueueToken";
import { listAppointmentsByDate, updateAppointmentStatus } from "../../services/appointmentService";
import type { AppointmentRow } from "../../types/admin";

function toneFor(status: string | null) {
  const key = (status || "").toLowerCase();
  if (key === "waiting") return "warning" as const;
  if (key === "in_progress") return "info" as const;
  if (key === "completed") return "success" as const;
  if (key === "cancelled") return "danger" as const;
  return "neutral" as const;
}

export function ReceptionAppointmentsPage() {
  const { push } = useToast();
  const [rows, setRows] = useState<AppointmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [checkingInId, setCheckingInId] = useState<number | null>(null);
  const today = clinicToday();

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    listAppointmentsByDate(today)
      .then(setRows)
      .catch((reason: unknown) => {
        setRows([]);
        setError(reason instanceof AppError ? reason.message : "Unable to load today's appointments.");
      })
      .finally(() => setLoading(false));
  }, [today]);

  useEffect(() => {
    load();
  }, [load]);

  async function checkIn(appointmentId: number) {
    setCheckingInId(appointmentId);
    try {
      await updateAppointmentStatus(appointmentId, "waiting");
      push("Patient checked in.", "success");
      load();
    } catch (reason: unknown) {
      push(reason instanceof AppError ? reason.message : "Could not check in this appointment.", "danger");
    } finally {
      setCheckingInId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Appointments"
        description={`Today, ${formatClinicDateLabel(today)}`}
        actions={<Link to="/reception/patients" className="inline-flex min-h-10 items-center rounded-md border border-primary-hover bg-primary-hover px-4 text-base font-semibold text-white">Book</Link>}
      />
      <QueryState loading={loading} error={error} onRetry={load}>
        {rows.length === 0 ? (
          <EmptyState title="No appointments today" description="Select a patient from the Patients list to book a visit." action={<Link to="/reception/patients" className="font-semibold text-primary-hover">Go to patients</Link>} />
        ) : (
          <div className="grid gap-3">
            {rows.map((row) => {
              const status = (row.status || "").toLowerCase();
              return (
                <Card key={row.appointment_id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold">{row.patient_name || "Patient"}</p>
                      <p className="text-sm text-muted">Doctor: {row.doctor_name?.trim() || "—"} · {formatAppointmentTime(row.scheduled_time)}</p>
                      <p className="text-sm text-muted">Dept: {(row.department || row.doctor_specialization || "").trim() || "Not specified"} · Code: {row.patient_code || "—"}</p>
                    </div>
                    <StatusBadge label={statusLabel(row.status)} tone={toneFor(row.status)} />
                  </div>
                  {status === "scheduled" ? (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
                      <p className="text-sm text-muted">Patient not checked in yet. Booked slot stays {formatAppointmentTime(row.scheduled_time)}.</p>
                      <Button loading={checkingInId === row.appointment_id} onClick={() => void checkIn(row.appointment_id)}>Check in</Button>
                    </div>
                  ) : null}
                  {row.queue_token ? (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
                      <QueueToken token={row.queue_token} />
                      <Button
                        variant="secondary"
                        onClick={() => {
                          const message = printQueueToken(row);
                          if (message) push(message, "warning");
                        }}
                      >
                        Print token
                      </Button>
                    </div>
                  ) : null}
                </Card>
              );
            })}
          </div>
        )}
      </QueryState>
    </div>
  );
}
