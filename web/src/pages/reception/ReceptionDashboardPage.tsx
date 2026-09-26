import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppError } from "../../api/errors";
import { QueryState, statusLabel } from "../../admin/QueryState";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { KpiCard } from "../../components/ui/KpiCard";
import { PageHeader } from "../../components/ui/PageHeader";
import { PatientAvatar } from "../../components/ui/PatientAvatar";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { useAuth } from "../../auth/useAuth";
import { clinicToday, formatClinicDateLabel, formatRelativeTime } from "../../lib/clinicTime";
import { getReceptionistStats } from "../../services/dashboardService";
import { listRecentPatients } from "../../services/patientService";
import type { RecentPatient, ReceptionistStats } from "../../types/admin";

export function ReceptionDashboardPage() {
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ReceptionistStats | null>(null);
  const [statsError, setStatsError] = useState("");
  const [recent, setRecent] = useState<RecentPatient[]>([]);
  const [recentError, setRecentError] = useState("");

  function load() {
    setLoading(true);
    setStatsError("");
    setRecentError("");
    const statsRequest = getReceptionistStats()
      .then(setStats)
      .catch((reason: unknown) => {
        setStats(null);
        setStatsError(reason instanceof AppError ? reason.message : "Unable to load today's overview. Please try again.");
      });
    const recentRequest = listRecentPatients(5)
      .then(setRecent)
      .catch((reason: unknown) => {
        setRecent([]);
        setRecentError(reason instanceof AppError ? reason.message : "Unable to load recent registrations. Please try again.");
      });
    void Promise.all([statsRequest, recentRequest]).finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  const firstName = session?.name.split(" ")[0] || "there";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Hello, ${firstName}`}
        description={formatClinicDateLabel(clinicToday())}
        actions={
          <Link to="/reception/register" className="inline-flex min-h-10 items-center rounded-md border border-primary-hover bg-primary-hover px-4 text-base font-semibold text-white">
            Register Patient
          </Link>
        }
      />
      {statsError ? (
        <ErrorState title="Unable to load today's overview" description={statsError} action={<Button variant="secondary" onClick={load}>Retry</Button>} />
      ) : (
        <QueryState loading={loading && !stats} error="">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Link to="/reception/patients" className="block rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
              <KpiCard label="Registered" value={stats ? String(stats.registered_today) : "—"} hint="Today" />
            </Link>
            <Link to="/reception/queue" className="block rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
              <KpiCard label="In Queue" value={stats ? String(stats.in_queue) : "—"} hint="Waiting and in progress today" />
            </Link>
            <Link to="/reception/appointments" className="block rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
              <KpiCard label="Appointments" value={stats ? String(stats.appointments_today) : "—"} hint="Today" />
            </Link>
            <KpiCard label="Avg Wait" value={stats?.avg_wait_minutes != null ? `${stats.avg_wait_minutes} min` : "—"} />
          </div>
        </QueryState>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Link to="/reception/patients" className="rounded-lg border border-line bg-surface p-4 font-semibold text-ink">Book Appointment</Link>
        <Link to="/reception/patients" className="rounded-lg border border-line bg-surface p-4 font-semibold text-ink">View Patients</Link>
        <Link to="/reception/queue" className="rounded-lg border border-line bg-surface p-4 font-semibold text-ink">Today's Queue</Link>
        <Link to="/reception/appointments" className="rounded-lg border border-line bg-surface p-4 font-semibold text-ink">Today's Appointments</Link>
      </div>
      <Card>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-ink">Recent registrations</h2>
          <Link to="/reception/patients" className="text-sm font-semibold text-primary-hover">View all</Link>
        </div>
        {recentError ? (
          <div className="mt-4">
            <ErrorState title="Unable to load recent registrations" description={recentError} action={<Button variant="secondary" onClick={load}>Retry</Button>} />
          </div>
        ) : loading && recent.length === 0 ? (
          <p className="mt-4 text-sm text-muted">Loading recent registrations.</p>
        ) : recent.length === 0 ? (
          <div className="mt-4">
            <EmptyState title="No patients registered yet" />
          </div>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {recent.map((patient) => (
              <li key={patient.patient_id}>
                <Link
                  to={`/reception/book?patient_id=${patient.patient_id}&name=${encodeURIComponent(patient.name)}&patient_code=${encodeURIComponent(patient.patient_code || "")}`}
                  className="flex items-center gap-3 rounded-lg border border-line p-3"
                >
                  <PatientAvatar name={patient.name || "Patient"} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{patient.name}</p>
                    <p className="text-sm text-muted">{patient.patient_code || "—"} · {patient.department?.trim() || "Not specified"}</p>
                  </div>
                  <div className="text-right">
                    <StatusBadge label={patient.status === "assigned" ? "Assigned" : statusLabel(patient.status)} tone={patient.status === "assigned" ? "success" : "warning"} />
                    <p className="mt-1 text-sm text-muted">{formatRelativeTime(patient.created_at)}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
