import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppError } from "../../api/errors";
import { QueryState } from "../../admin/QueryState";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { PageHeader } from "../../components/ui/PageHeader";
import { PatientAvatar } from "../../components/ui/PatientAvatar";
import { SearchInput } from "../../components/ui/SearchInput";
import { listPatients } from "../../services/patientService";
import type { PatientListItem } from "../../types/admin";

export function DoctorPatientsPage() {
  const [query, setQuery] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [patients, setPatients] = useState<PatientListItem[]>([]);

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
          setError(reason instanceof AppError ? reason.message : "Unable to load patients. Please try again.");
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 350);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, reloadKey]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Patients" description="Search by name, code, or phone, then open visit history." />
      <SearchInput id="doctor-patient-search" label="Search patients" hint="Nothing is selected automatically." value={query} onChange={(event) => setQuery(event.target.value)} />
      <QueryState loading={loading && patients.length === 0} error={error} onRetry={() => setReloadKey((value) => value + 1)}>
        {patients.length === 0 ? (
          <EmptyState
            title={query.trim() ? "No matching patients" : "No patients found"}
            description={query.trim() ? "Try a different name, code, or phone number." : "Registered patients will appear here."}
          />
        ) : (
          <div className="grid gap-3">
            {patients.map((patient) => (
              <Link key={patient.patient_id} to={`/doctor/patients/${patient.patient_id}/history`} className="block rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                <Card className="flex items-start gap-3">
                  <PatientAvatar name={patient.name || "Patient"} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-semibold">{patient.name}</p>
                    <p className="text-sm text-muted">{[patient.patient_code || "—", patient.age != null ? `${patient.age}y` : null, patient.phone, patient.department].filter(Boolean).join(" · ")}</p>
                    {patient.latest_clinical_summary ? <p className="mt-2 text-sm text-ink">{patient.latest_clinical_summary}</p> : null}
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
