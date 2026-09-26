import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AppError } from "../../api/errors";
import { QueryState, statusLabel } from "../../admin/QueryState";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { PageHeader } from "../../components/ui/PageHeader";
import { PatientAvatar } from "../../components/ui/PatientAvatar";
import { SearchInput } from "../../components/ui/SearchInput";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { listPatients } from "../../services/patientService";
import type { PatientListItem } from "../../types/admin";

type Filter = "all" | "waiting" | "assigned" | "past";

function bucket(patient: PatientListItem): Filter {
  const status = (patient.status || "").toLowerCase();
  if (status === "waiting") return "waiting";
  if (status === "assigned") return "assigned";
  if ((patient.visit_count ?? 0) > 0) return "past";
  return "assigned";
}

export function PatientsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [patients, setPatients] = useState<PatientListItem[]>([]);

  function load() {
    setLoading(true);
    setError("");
    listPatients()
      .then(setPatients)
      .catch((reason: unknown) => setError(reason instanceof AppError ? reason.message : "Unable to load patients."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return patients.filter((patient) => {
      const matchesQuery = !q || [patient.name, patient.patient_code, patient.phone, patient.department, String(patient.patient_id)].some((value) => (value || "").toLowerCase().includes(q));
      return matchesQuery && (filter === "all" || bucket(patient) === filter);
    });
  }, [patients, query, filter]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Patients" description="Directory from the existing patient list. There is no separate patient-by-id API." />
      <SearchInput id="patient-search" label="Search patients" hint="Matches name, code, or phone. Nothing is selected automatically." value={query} onChange={(event) => setQuery(event.target.value)} />
      <div className="flex flex-wrap gap-2">
        {(["all", "waiting", "assigned", "past"] as const).map((item) => (
          <button key={item} type="button" className={`min-h-10 rounded-md border px-4 text-sm font-semibold ${filter === item ? "border-primary-hover bg-mint text-primary-hover" : "border-line bg-surface text-ink"}`} onClick={() => setFilter(item)}>
            {item === "all" ? "All" : item === "waiting" ? "In queue" : item === "assigned" ? "Active" : "Past"}
          </button>
        ))}
      </div>
      <QueryState loading={loading} error={error} onRetry={load}>
        {visible.length === 0 ? (
          <EmptyState title="No patients found" description="Try another search." />
        ) : (
          <div className="grid gap-3">
            {visible.map((patient) => (
              <Link key={patient.patient_id} to={`/admin/patients/${patient.patient_id}`} className="block rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                <Card className="flex items-center gap-3">
                  <PatientAvatar name={patient.name || "Patient"} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-semibold">{patient.name}</p>
                    <p className="text-sm text-muted">{patient.patient_code || "No code"} · {patient.department || "No department"} · {patient.visit_count} visits</p>
                  </div>
                  <StatusBadge label={statusLabel(patient.status)} tone={patient.status === "waiting" ? "warning" : "neutral"} />
                </Card>
              </Link>
            ))}
          </div>
        )}
      </QueryState>
    </div>
  );
}
