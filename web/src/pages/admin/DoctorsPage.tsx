import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppError } from "../../api/errors";
import { QueryState } from "../../admin/QueryState";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { PageHeader } from "../../components/ui/PageHeader";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { listDoctors } from "../../services/doctorService";
import type { DoctorSummary } from "../../types/admin";

export function DoctorsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [doctors, setDoctors] = useState<DoctorSummary[]>([]);

  function load() {
    setLoading(true);
    setError("");
    listDoctors()
      .then(setDoctors)
      .catch((reason: unknown) => setError(reason instanceof AppError ? reason.message : "Unable to load doctors."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Doctors"
        description="Clinic doctors from the existing directory."
        actions={<Link className="inline-flex min-h-10 items-center rounded-md border border-primary-hover bg-primary-hover px-4 text-base font-semibold text-white" to="/admin/doctors/new">Add doctor</Link>}
      />
      <QueryState loading={loading} error={error} onRetry={load}>
        {doctors.length === 0 ? (
          <EmptyState title="No doctors found" description="Add a doctor to start the directory." action={<Link className="inline-flex min-h-10 items-center rounded-md border border-line px-4 font-semibold" to="/admin/doctors/new">Add doctor</Link>} />
        ) : (
          <div className="grid gap-3">
            {doctors.map((doctor) => (
              <Link key={doctor.doctor_id} to={`/admin/doctors/${doctor.doctor_id}`} className="block rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                <Card className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-lg font-semibold text-ink">{doctor.name || "Unknown doctor"}</p>
                    <p className="text-sm text-muted">{doctor.specialization || "No specialization"}</p>
                  </div>
                  <StatusBadge label={doctor.availability_status || "Active"} tone={doctor.availability_status === "available" ? "success" : "warning"} />
                </Card>
              </Link>
            ))}
          </div>
        )}
      </QueryState>
    </div>
  );
}
