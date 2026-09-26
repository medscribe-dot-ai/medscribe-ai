import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AppError } from "../../api/errors";
import { QueryState, statusLabel } from "../../admin/QueryState";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { PageHeader } from "../../components/ui/PageHeader";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { formatAppointmentDateTime } from "../../lib/clinicTime";
import { getPatientFromList, getPatientHistory } from "../../services/patientService";
import type { PatientHistory, PatientListItem } from "../../types/admin";

export function PatientDetailPage() {
  const { patientId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [basics, setBasics] = useState<PatientListItem | null>(null);
  const [history, setHistory] = useState<PatientHistory | null>(null);

  function load() {
    const id = Number(patientId);
    if (!Number.isInteger(id)) {
      setError("Patient not found.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    Promise.all([getPatientFromList(id), getPatientHistory(id)])
      .then(([listItem, hist]) => {
        setBasics(listItem);
        setHistory(hist);
      })
      .catch((reason: unknown) => setError(reason instanceof AppError ? reason.message : "Unable to load this patient."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [patientId]);

  const name = basics?.name || history?.patient_name || "Patient";

  return (
    <div className="flex flex-col gap-6">
      <QueryState loading={loading} error={error} onRetry={load}>
        <PageHeader
          title={name}
          description={basics?.patient_code || history?.patient_code || "Patient history"}
          actions={<Link className="inline-flex min-h-10 items-center font-semibold text-primary-hover" to="/admin/patients">Back to patients</Link>}
        />
        <Card>
          <dl className="grid gap-3 sm:grid-cols-3">
            <div><dt className="text-sm text-muted">Age</dt><dd className="font-semibold">{basics?.age ?? "—"}</dd></div>
            <div><dt className="text-sm text-muted">Phone</dt><dd className="font-semibold">{basics?.phone || "—"}</dd></div>
            <div><dt className="text-sm text-muted">Department</dt><dd className="font-semibold">{basics?.department || "—"}</dd></div>
          </dl>
          {basics?.latest_clinical_summary ? <p className="mt-4 text-sm text-ink">{basics.latest_clinical_summary}</p> : null}
        </Card>
        <h2 className="text-xl font-semibold">Visit history</h2>
        {!history || history.visits.length === 0 ? (
          <EmptyState title="No visits yet" description="Completed and scheduled visits will appear here." />
        ) : (
          <div className="grid gap-3">
            {history.visits.map((visit) => (
              <Card key={visit.appointment_id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{visit.doctor_name || "Doctor"}</p>
                  <StatusBadge label={statusLabel(visit.status)} />
                </div>
                <p className="mt-1 text-sm text-muted">{formatAppointmentDateTime(visit.scheduled_time)}</p>
                {visit.clinical_summary ? <p className="mt-3 text-sm">{visit.clinical_summary}</p> : null}
                {visit.consultation_status === "completed" && visit.soap_sections ? (
                  <dl className="mt-3 grid gap-2 text-sm">
                    <div><dt className="font-semibold">Subjective</dt><dd>{visit.soap_sections.subjective || "—"}</dd></div>
                    <div><dt className="font-semibold">Objective</dt><dd>{visit.soap_sections.objective || "—"}</dd></div>
                    <div><dt className="font-semibold">Assessment</dt><dd>{visit.soap_sections.assessment || "—"}</dd></div>
                    <div><dt className="font-semibold">Plan</dt><dd>{visit.soap_sections.plan || "—"}</dd></div>
                  </dl>
                ) : null}
              </Card>
            ))}
          </div>
        )}
      </QueryState>
    </div>
  );
}
