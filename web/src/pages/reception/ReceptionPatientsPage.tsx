import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppError } from "../../api/errors";
import { QueryState } from "../../admin/QueryState";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { PageHeader } from "../../components/ui/PageHeader";
import { PatientAvatar } from "../../components/ui/PatientAvatar";
import { SearchInput } from "../../components/ui/SearchInput";
import { formatAppointmentDateTime } from "../../lib/clinicTime";
import { listPatients } from "../../services/patientService";
import type { PatientListItem } from "../../types/admin";

export function ReceptionPatientsPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [patients, setPatients] = useState<PatientListItem[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError("");
      listPatients(query)
        .then((rows) => {
          if (!controller.signal.aborted) setPatients(rows);
        })
        .catch((reason: unknown) => {
          if (controller.signal.aborted) return;
          setPatients([]);
          setError(reason instanceof AppError ? reason.message : "Unable to load patients.");
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 400);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, reloadKey]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Patients"
        description="Search by name, code, or phone. A result is booked only when you choose it."
        actions={
          <Link to="/reception/register" className="inline-flex min-h-10 items-center rounded-md border border-primary-hover bg-primary-hover px-4 text-base font-semibold text-white">
            Register
          </Link>
        }
      />
      <SearchInput id="reception-patient-search" label="Search patients" hint="Matches name, patient code, or phone." value={query} onChange={(event) => setQuery(event.target.value)} />
      <QueryState loading={loading && patients.length === 0} error={error} onRetry={() => setReloadKey((value) => value + 1)}>
        {patients.length === 0 ? (
          <EmptyState
            title={query.trim() ? "No patients match your search." : "No patients registered yet."}
            description="Try another search or register a new patient."
            action={<Link to="/reception/register" className="text-sm font-semibold text-primary-hover">Register patient</Link>}
          />
        ) : (
          <div className="grid gap-3">
            {patients.map((patient) => (
              <Link
                key={patient.patient_id}
                to={`/reception/book?patient_id=${patient.patient_id}&name=${encodeURIComponent(patient.name)}&patient_code=${encodeURIComponent(patient.patient_code || "")}`}
                className="block rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <Card className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <PatientAvatar name={patient.name || "Patient"} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-semibold">{patient.name}</p>
                    <p className="text-sm text-muted">{patient.age ? `${patient.age}y` : "—"} · {patient.patient_code || "—"}</p>
                    <p className="text-sm text-muted">{patient.phone || "N/A"} · {patient.visit_count} visit{patient.visit_count === 1 ? "" : "s"}</p>
                    <p className="mt-1 text-sm font-semibold text-primary-hover">Book appointment</p>
                  </div>
                  <div className="text-sm text-muted">
                    <p className="font-semibold text-ink">{patient.department?.trim() || "Not specified"}</p>
                    <p>{formatAppointmentDateTime(patient.created_at)}</p>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </QueryState>
    </div>
  );
}
