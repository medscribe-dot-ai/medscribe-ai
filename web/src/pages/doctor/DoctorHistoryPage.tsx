import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { AppError } from "../../api/errors";
import { QueryState, statusLabel } from "../../admin/QueryState";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { PageHeader } from "../../components/ui/PageHeader";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { formatAppointmentDateTime } from "../../lib/clinicTime";
import { getPatientFromList, getPatientHistory } from "../../services/patientService";
import type { PatientHistory, PatientHistoryVisit, PatientListItem } from "../../types/admin";

function soapSections(visit: PatientHistoryVisit) {
  const sections = [
    { key: "assessment", label: "Assessment", value: visit.soap_sections?.assessment },
    { key: "plan", label: "Plan", value: visit.soap_sections?.plan },
    { key: "subjective", label: "Subjective", value: visit.soap_sections?.subjective },
    { key: "objective", label: "Objective", value: visit.soap_sections?.objective },
  ].filter((section) => Boolean(section.value && section.value.trim()));
  const rawNote = sections.length === 0 && visit.soap_note?.trim() ? visit.soap_note.trim() : null;
  return { sections, rawNote };
}

function VisitCard({ visit }: { visit: PatientHistoryVisit }) {
  const [open, setOpen] = useState(false);
  const { sections, rawNote } = soapSections(visit);
  const summary = visit.clinical_summary?.trim() || "";
  const hasDetail = sections.length > 0 || Boolean(rawNote);
  const showDetail = summary ? open : hasDetail;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="font-semibold text-primary-hover">{formatAppointmentDateTime(visit.scheduled_time)}</p>
        <StatusBadge label={statusLabel(visit.status)} />
      </div>
      {visit.doctor_name?.trim() ? <p className="mt-2 text-sm font-semibold">{visit.doctor_name}</p> : null}
      {visit.queue_token ? <p className="text-sm text-muted">Token: {visit.queue_token}</p> : null}
      {summary ? (
        <div className="mt-3 rounded-md border border-primary/30 bg-mint p-3">
          <p className="text-sm font-semibold text-primary-hover">Clinical summary</p>
          <p className="mt-1 text-sm">{summary}</p>
        </div>
      ) : null}
      {summary && hasDetail ? (
        <Button variant="ghost" className="mt-2 px-0" onClick={() => setOpen((value) => !value)}>
          {open ? "Hide full SOAP" : "View full SOAP"}
        </Button>
      ) : null}
      {showDetail && sections.length > 0 ? (
        <dl className="mt-3 grid gap-2 text-sm">
          {sections.map((section) => (
            <div key={section.key}>
              <dt className="font-semibold">{section.label}</dt>
              <dd>{section.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {showDetail && rawNote ? <p className="mt-3 text-sm">{rawNote}</p> : null}
      {!summary && !hasDetail ? <p className="mt-3 text-sm text-muted">No SOAP content available for this visit.</p> : null}
    </Card>
  );
}

export function DoctorHistoryPage() {
  const { patientId } = useParams();
  const [params] = useSearchParams();
  const excludeId = Number(params.get("exclude_appointment_id"));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [basics, setBasics] = useState<PatientListItem | null>(null);
  const [history, setHistory] = useState<PatientHistory | null>(null);

  function load() {
    const id = Number(patientId);
    if (!Number.isInteger(id) || id <= 0) {
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
      .catch((reason: unknown) => setError(reason instanceof AppError ? reason.message : "Unable to load visit history."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [patientId]);

  const visits = useMemo(() => {
    return (history?.visits ?? []).filter((visit) => {
      if ((visit.consultation_status || "").toLowerCase().trim() !== "completed") return false;
      if (Number.isInteger(excludeId) && excludeId > 0 && visit.appointment_id === excludeId) return false;
      return true;
    });
  }, [history, excludeId]);

  const name = basics?.name || history?.patient_name || "Patient";

  return (
    <div className="flex flex-col gap-6">
      <QueryState loading={loading} error={error} onRetry={load}>
        <PageHeader
          title={name}
          description={basics?.patient_code || history?.patient_code || "Visit history"}
          actions={<Link to="/doctor/patients" className="inline-flex min-h-10 items-center font-semibold text-primary-hover">Back to patients</Link>}
        />
        <Card>
          <dl className="grid gap-3 sm:grid-cols-3">
            <div><dt className="text-sm text-muted">Age</dt><dd className="font-semibold">{basics?.age != null ? `${basics.age} years` : "—"}</dd></div>
            <div><dt className="text-sm text-muted">Phone</dt><dd className="font-semibold">{basics?.phone || "—"}</dd></div>
            <div><dt className="text-sm text-muted">Department</dt><dd className="font-semibold">{basics?.department || "—"}</dd></div>
          </dl>
        </Card>
        <h2 className="text-xl font-semibold">Completed visits</h2>
        {visits.length === 0 ? (
          <EmptyState title="No completed visits" description="Approved consultations will appear here." />
        ) : (
          <div className="grid gap-3">
            {visits.map((visit) => (
              <VisitCard key={visit.appointment_id} visit={visit} />
            ))}
          </div>
        )}
      </QueryState>
    </div>
  );
}
