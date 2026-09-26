import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AppError } from "../../api/errors";
import { QueryState } from "../../admin/QueryState";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Dialog } from "../../components/ui/Dialog";
import { PageHeader } from "../../components/ui/PageHeader";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { deleteDoctor, getDoctor } from "../../services/doctorService";
import type { DoctorDetail } from "../../types/admin";

export function DoctorDetailPage() {
  const { doctorId } = useParams();
  const navigate = useNavigate();
  const [doctor, setDoctor] = useState<DoctorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function load() {
    const id = Number(doctorId);
    if (!Number.isInteger(id)) {
      setError("Doctor not found.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    getDoctor(id)
      .then(setDoctor)
      .catch((reason: unknown) => setError(reason instanceof AppError ? reason.message : "Unable to load this doctor."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [doctorId]);

  async function remove() {
    if (!doctor || deleting) return;
    setDeleting(true);
    try {
      await deleteDoctor(doctor.doctor_id);
      navigate("/admin/doctors", { replace: true });
    } catch (reason: unknown) {
      setError(reason instanceof AppError ? reason.message : "Unable to delete this doctor.");
      setConfirming(false);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <QueryState loading={loading} error={error} onRetry={load}>
        {doctor ? (
          <>
            <PageHeader
              title={doctor.name}
              description={doctor.specialization || "Doctor"}
              actions={
                <>
                  <Link className="inline-flex min-h-10 items-center rounded-md border border-line bg-surface px-4 font-semibold text-ink" to={`/admin/doctors/${doctor.doctor_id}/edit`}>Edit</Link>
                  <Button variant="danger" onClick={() => setConfirming(true)}>Delete</Button>
                </>
              }
            />
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <h2 className="text-lg font-semibold">Account</h2>
                <dl className="mt-3 grid gap-2 text-base">
                  <div><dt className="text-sm text-muted">Username</dt><dd>{doctor.username}</dd></div>
                  <div><dt className="text-sm text-muted">Email</dt><dd>{doctor.email}</dd></div>
                  <div><dt className="text-sm text-muted">Phone</dt><dd>{doctor.phone || "—"}</dd></div>
                  <div><dt className="text-sm text-muted">Experience</dt><dd>{doctor.experience_years ?? "—"} years</dd></div>
                  <div><dt className="text-sm text-muted">Status</dt><dd><StatusBadge label={doctor.availability_status || "Active"} tone="success" /></dd></div>
                </dl>
              </Card>
              <Card>
                <h2 className="text-lg font-semibold">Weekly schedule</h2>
                {Object.keys(doctor.schedule).length === 0 ? <p className="mt-3 text-sm text-muted">No schedule set.</p> : (
                  <ul className="mt-3 divide-y divide-line">
                    {Object.entries(doctor.schedule).map(([day, time]) => (
                      <li key={day} className="flex min-h-10 items-center justify-between gap-3 py-2">
                        <span className="font-semibold">{day}</span>
                        <span>{time}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </>
        ) : null}
      </QueryState>
      <Dialog open={confirming} title="Delete this doctor?" onClose={() => setConfirming(false)}>
        <p>This permanently removes the doctor account and related clinic records.</p>
        <div className="mt-4">
          <Button variant="danger" loading={deleting} onClick={remove}>Delete doctor</Button>
        </div>
      </Dialog>
    </div>
  );
}
