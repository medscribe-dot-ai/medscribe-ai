import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppError } from "../../api/errors";
import { QueryState, statusLabel } from "../../admin/QueryState";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { KpiCard } from "../../components/ui/KpiCard";
import { PageHeader } from "../../components/ui/PageHeader";
import { QueueToken } from "../../components/ui/QueueToken";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { clinicToday, formatAppointmentTime } from "../../lib/clinicTime";
import { listAppointmentsByDate } from "../../services/appointmentService";
import { listDoctors } from "../../services/doctorService";
import { listPatients } from "../../services/patientService";
import { listReceptionists } from "../../services/receptionistService";
import type { AppointmentRow } from "../../types/admin";

function toneFor(status: string | null) {
  const key = (status || "").toLowerCase();
  if (key === "waiting") return "warning" as const;
  if (key === "in_progress") return "info" as const;
  if (key === "completed") return "success" as const;
  if (key === "cancelled") return "danger" as const;
  return "neutral" as const;
}

export function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [counts, setCounts] = useState({ doctors: 0, receptionists: 0, patients: 0 });
  const [rows, setRows] = useState<AppointmentRow[]>([]);

  function load() {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    Promise.all([listDoctors(), listReceptionists(), listPatients(), listAppointmentsByDate(clinicToday())])
      .then(([doctors, receptionists, patients, appointments]) => {
        if (controller.signal.aborted) return;
        setCounts({ doctors: doctors.length, receptionists: receptionists.length, patients: patients.length });
        setRows(
          appointments.filter((row) => ["waiting", "in_progress"].includes((row.status || "").toLowerCase())),
        );
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setError(reason instanceof AppError ? reason.message : "Unable to load today's clinic activity.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }

  useEffect(() => load(), []);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Admin" description="Clinic counts and today's live OPD." />
      <QueryState loading={loading} error={error} onRetry={load}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Link to="/admin/doctors" className="block rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            <KpiCard label="Doctors" value={String(counts.doctors)} />
          </Link>
          <Link to="/admin/receptionists" className="block rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            <KpiCard label="Receptionists" value={String(counts.receptionists)} />
          </Link>
          <Link to="/admin/patients" className="block rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            <KpiCard label="Patients" value={String(counts.patients)} />
          </Link>
        </div>
        <Card>
          <h2 className="text-xl font-semibold text-ink">Live OPD</h2>
          <p className="mt-1 text-sm text-muted">Waiting and in-progress visits for today.</p>
          {rows.length === 0 ? (
            <div className="mt-4">
              <EmptyState title="No active OPD activity" description="Waiting and in-progress visits will appear here." />
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto" tabIndex={0} aria-label="Today's live OPD, scroll sideways for more columns">
              <table className="w-full min-w-[640px] text-left text-sm">
                <caption className="sr-only">Waiting and in-progress visits for today</caption>
                <thead>
                  <tr className="border-b border-line text-muted">
                    <th scope="col" className="py-2 pr-3 font-semibold">Doctor</th>
                    <th scope="col" className="py-2 pr-3 font-semibold">Patient</th>
                    <th scope="col" className="py-2 pr-3 font-semibold">Status</th>
                    <th scope="col" className="py-2 pr-3 font-semibold">Token</th>
                    <th scope="col" className="py-2 font-semibold">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.appointment_id} className="border-b border-line last:border-0">
                      <td className="py-3 pr-3 font-semibold text-ink">{row.doctor_name || "Doctor"}</td>
                      <td className="py-3 pr-3">{row.patient_name || row.patient_code || "Patient"}</td>
                      <td className="py-3 pr-3">
                        <StatusBadge label={statusLabel(row.status)} tone={toneFor(row.status)} />
                      </td>
                      <td className="py-3 pr-3">{row.queue_token ? <QueueToken token={row.queue_token} /> : "—"}</td>
                      <td className="py-3">{formatAppointmentTime(row.scheduled_time)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </QueryState>
    </div>
  );
}
