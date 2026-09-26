import { useEffect, useState } from "react";
import { AppError } from "../../api/errors";
import { QueryState } from "../../admin/QueryState";
import { useAuth } from "../../auth/useAuth";
import { Card } from "../../components/ui/Card";
import { PageHeader } from "../../components/ui/PageHeader";
import { PatientAvatar } from "../../components/ui/PatientAvatar";
import { getDoctor } from "../../services/doctorService";
import type { DoctorDetail } from "../../types/admin";

export function DoctorProfilePage() {
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [doctor, setDoctor] = useState<DoctorDetail | null>(null);

  function load() {
    const doctorId = session?.doctor_id;
    if (doctorId == null) {
      setDoctor(null);
      setError("");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    getDoctor(doctorId)
      .then(setDoctor)
      .catch((reason: unknown) => {
        setDoctor(null);
        setError(reason instanceof AppError ? reason.message : "Unable to load doctor profile.");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [session?.doctor_id]);

  const name = doctor?.name || session?.name || "Doctor";

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <PageHeader title="Profile" description="Signed-in doctor session." />
      <QueryState loading={loading} error={error} onRetry={load}>
        <Card className="flex items-center gap-4">
          <PatientAvatar name={name} />
          <div>
            <p className="text-2xl font-semibold">{name}</p>
            <p className="text-sm text-muted">{doctor?.specialization?.trim() || "Medical specialist"}</p>
          </div>
        </Card>
        <Card>
          <h2 className="text-lg font-semibold">Professional information</h2>
          <dl className="mt-3 grid gap-3">
            <div><dt className="text-sm text-muted">Email</dt><dd className="font-semibold">{doctor?.email || session?.email || "—"}</dd></div>
            <div><dt className="text-sm text-muted">Phone</dt><dd className="font-semibold">{doctor?.phone || "—"}</dd></div>
            <div><dt className="text-sm text-muted">Experience</dt><dd className="font-semibold">{doctor?.experience_years != null ? `${doctor.experience_years} years` : "—"}</dd></div>
            <div><dt className="text-sm text-muted">Role</dt><dd className="font-semibold">Doctor</dd></div>
          </dl>
        </Card>
      </QueryState>
    </div>
  );
}
