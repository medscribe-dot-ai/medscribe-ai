import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AppError } from "../../api/errors";
import { QueryState, statusLabel } from "../../admin/QueryState";
import { useAuth } from "../../auth/useAuth";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { ErrorState } from "../../components/ui/ErrorState";
import { Skeleton } from "../../components/ui/Skeleton";
import { Dialog } from "../../components/ui/Dialog";
import { Label } from "../../components/ui/Label";
import { PageHeader } from "../../components/ui/PageHeader";
import { Textarea } from "../../components/ui/Textarea";
import { SOAP_KEYS, SOAP_LABELS, buildSoapFromSections, parseSoapNote, type SoapKey } from "../../doctor/soapNote";
import { formatAppointmentDateTime } from "../../lib/clinicTime";
import { approveSoap, getConsultationStatus } from "../../services/consultationService";
import { getPatientHistory } from "../../services/patientService";
import type { PatientHistoryVisit } from "../../types/admin";

const EMPTY: Record<SoapKey, string> = { subjective: "", objective: "", assessment: "", plan: "" };

export function DoctorSoapPage() {
  const { consultationId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const id = Number(consultationId);
  const patientId = Number(params.get("patient_id"));
  const appointmentId = Number(params.get("appointment_id"));
  const fromQueue = params.get("from_queue") === "1";
  const patientName = params.get("patient_name") || "Patient";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [raw, setRaw] = useState("");
  const [sections, setSections] = useState(EMPTY);
  const [dirty, setDirty] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approved, setApproved] = useState(false);
  const [visits, setVisits] = useState<PatientHistoryVisit[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [historyAttempt, setHistoryAttempt] = useState(0);
  const [includeCurrent, setIncludeCurrent] = useState(false);
  const inFlight = useRef(false);

  const readOnly = approved || status === "completed";

  function load() {
    if (!Number.isInteger(id) || id <= 0) {
      setError("Consultation not found.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    getConsultationStatus(id)
      .then((result) => {
        const nextStatus = (result.status || "").toLowerCase();
        setStatus(nextStatus);
        setTranscript(result.transcript || "");
        const note = result.soap_note?.trim() || "";
        if (!["pending_approval", "completed"].includes(nextStatus)) {
          setError(nextStatus === "queued" || nextStatus === "processing" ? "The SOAP note is still being processed." : `SOAP note is not available for review (status: ${statusLabel(nextStatus)}).`);
          return;
        }
        if (!note) {
          setError("No SOAP note was returned for this consultation.");
          return;
        }
        setRaw(note);
        setSections(parseSoapNote(note));
        setApproved(nextStatus === "completed");
      })
      .catch((reason: unknown) => setError(reason instanceof AppError ? reason.message : "Unable to load SOAP note."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [consultationId]);

  useEffect(() => {
    if (!Number.isInteger(patientId) || patientId <= 0) return;
    setHistoryLoading(true);
    setHistoryError("");
    getPatientHistory(patientId)
      .then((history) => {
        setVisits(
          history.visits.filter((visit) => {
            if (!includeCurrent && Number.isInteger(appointmentId) && visit.appointment_id === appointmentId) return false;
            return (visit.consultation_status || "").toLowerCase() === "completed";
          }),
        );
      })
      .catch((reason: unknown) => {
        setVisits([]);
        setHistoryError(reason instanceof AppError ? reason.message : "Unable to load visit history.");
      })
      .finally(() => setHistoryLoading(false));
  }, [patientId, appointmentId, historyAttempt, includeCurrent]);

  async function approve() {
    if (inFlight.current || readOnly) return;
    const finalSoap = dirty ? buildSoapFromSections(sections) : raw;
    if (!finalSoap.trim()) {
      setError("Cannot approve an empty SOAP note.");
      setConfirming(false);
      return;
    }
    inFlight.current = true;
    setApproving(true);
    setError("");
    try {
      await approveSoap(id, finalSoap, session?.doctor_id ?? null);
      setRaw(finalSoap);
      setSections(parseSoapNote(finalSoap));
      setDirty(false);
      setApproved(true);
      setStatus("completed");
      setIncludeCurrent(true);
      setHistoryAttempt((value) => value + 1);
      setConfirming(false);
    } catch (reason: unknown) {
      setError(reason instanceof AppError ? reason.message : "Unable to approve the SOAP note. Please try again.");
      setConfirming(false);
    } finally {
      inFlight.current = false;
      setApproving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="SOAP review"
        description={`${patientName} · ${statusLabel(status || "pending")}`}
        actions={
          readOnly ? (
            <Button onClick={() => navigate(fromQueue ? "/doctor/queue" : "/doctor")}>{fromQueue ? "Back to queue" : "Back to dashboard"}</Button>
          ) : (
            <Button loading={approving} onClick={() => setConfirming(true)}>Approve</Button>
          )
        }
      />
      {error && !loading && raw ? <Alert title="Approval failed" tone="danger">{error}</Alert> : null}
      {approved ? <Alert title="SOAP note approved" tone="success">The note is finalized. This visit is complete.</Alert> : null}
      <QueryState loading={loading} error="" onRetry={load}>
        {error && !raw ? (
          <ErrorState title="SOAP note unavailable" description={error} action={<Button variant="secondary" onClick={load}>Retry</Button>} />
        ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.8fr)]">
          <div className="flex flex-col gap-4">
            {SOAP_KEYS.map((key) => (
              <div key={key}>
                <Label htmlFor={`soap-${key}`}>{SOAP_LABELS[key]}</Label>
                <Textarea
                  id={`soap-${key}`}
                  value={sections[key]}
                  readOnly={readOnly}
                  onChange={(event) => {
                    const value = event.target.value;
                    setSections((current) => ({ ...current, [key]: value }));
                    setDirty(true);
                  }}
                />
              </div>
            ))}
            {!readOnly ? <Button className="lg:hidden" loading={approving} onClick={() => setConfirming(true)}>Approve</Button> : null}
          </div>
          <div className="flex flex-col gap-4">
            <Card>
              <h2 className="text-lg font-semibold">Patient</h2>
              <p className="mt-2 font-semibold">{patientName}</p>
              <p className="text-sm text-muted">{params.get("patient_code") || "—"}{params.get("queue_token") ? ` · Token ${params.get("queue_token")}` : ""}</p>
              {Number.isInteger(patientId) && patientId > 0 ? (
                <Link className="mt-3 inline-flex text-sm font-semibold text-primary-hover" to={`/doctor/patients/${patientId}/history${Number.isInteger(appointmentId) ? `?exclude_appointment_id=${appointmentId}` : ""}`}>
                  Full history
                </Link>
              ) : null}
            </Card>
            <Card>
              <h2 className="text-lg font-semibold">Previous visits</h2>
              {historyLoading ? <Skeleton className="mt-3 h-16 w-full" /> : null}
              {historyError ? (
                <div className="mt-3">
                  <ErrorState title="History unavailable" description={historyError} action={<Button variant="secondary" onClick={() => setHistoryAttempt((value) => value + 1)}>Retry</Button>} />
                </div>
              ) : null}
              {!historyLoading && !historyError && visits.length === 0 ? <p className="mt-2 text-sm text-muted">No earlier completed visits.</p> : null}
              {!historyLoading && !historyError && visits.length > 0 ? (
                <ul className="mt-3 flex flex-col gap-3">
                  {visits.slice(0, 4).map((visit) => (
                    <li key={visit.appointment_id} className="text-sm">
                      <p className="font-semibold">{formatAppointmentDateTime(visit.scheduled_time)}</p>
                      <p className="text-muted">{visit.clinical_summary?.trim() || "No clinical summary."}</p>
                    </li>
                  ))}
                </ul>
              ) : null}
            </Card>
            {transcript ? (
              <Card>
                <h2 className="text-lg font-semibold">Transcript</h2>
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{transcript}</p>
              </Card>
            ) : null}
          </div>
        </div>
        )}
      </QueryState>
      <Dialog open={confirming} title="Approve and finalize SOAP?" onClose={() => { if (!approving) setConfirming(false); }}>
        <p>Are you sure you want to approve and finalize this clinical documentation?</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button loading={approving} onClick={() => void approve()}>Approve and finalize</Button>
        </div>
      </Dialog>
    </div>
  );
}
