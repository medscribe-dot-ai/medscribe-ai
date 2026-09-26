import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AppError } from "../../api/errors";
import { useAuth } from "../../auth/useAuth";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { PageHeader } from "../../components/ui/PageHeader";
import { QueueToken } from "../../components/ui/QueueToken";
import { Skeleton } from "../../components/ui/Skeleton";
import { Spinner } from "../../components/ui/Spinner";
import { formatAppointmentDateTime } from "../../lib/clinicTime";
import { getSupabase } from "../../lib/supabase";
import { getPatientHistory } from "../../services/patientService";
import {
  getConsultationStatus,
  isTerminalConsultationStatus,
  processAudio,
  type ConsultationStatus,
} from "../../services/consultationService";
import type { PatientHistoryVisit } from "../../types/admin";

const POLL_MS = 6000;

const CHECKLIST = [
  "Audio uploaded",
  "Audio processing",
  "Transcription",
  "Speaker identification",
  "Medical correction",
  "SOAP generation",
  "Finalizing",
] as const;

function checklistIndex(phase: string, processingStep: string | null | undefined) {
  const step = (processingStep || "").toLowerCase().trim();
  if (phase === "idle") return -1;
  if (phase === "pending_approval" || phase === "completed" || step === "pending_approval" || step === "completed") {
    return CHECKLIST.length;
  }
  if (phase === "uploading" || step === "uploading") return 0;
  if (phase === "queued" || step === "queued") return 1;
  if (step === "started" || step === "downloading" || step === "cleaning") return 1;
  if (step === "transcribing") return 2;
  if (step === "labeling") return 3;
  if (step === "correcting") return 4;
  if (step === "generating" || step === "auditing") return 5;
  if (phase === "error" || phase === "rejected" || step === "error") return -1;
  if (phase === "processing") return 1;
  return 1;
}

const STATUS_TEXT: Record<string, string> = {
  uploading: "Uploading audio...",
  queued: "In queue. AI processing will begin shortly.",
  processing: "Analyzing the consultation...",
  pending_approval: "SOAP note is ready for review.",
  completed: "SOAP note approved and finalized.",
  rejected: "SOAP note rejected.",
  error: "Processing failed. Please try again.",
};

export function DoctorRecordPage() {
  const { appointmentId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const visitId = Number(appointmentId);
  const patientId = Number(params.get("patient_id"));
  const fromQueue = params.get("from_queue") === "1";
  const consultationParam = Number(params.get("consultation_id"));
  const patientName = params.get("patient_name") || "Patient";
  const patientCode = params.get("patient_code") || "—";
  const queueToken = params.get("queue_token") || "";

  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState(() => (Number.isInteger(consultationParam) && consultationParam > 0 ? "processing" : "idle"));
  const [status, setStatus] = useState<ConsultationStatus | null>(null);
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<PatientHistoryVisit | null>(null);
  const [historyLoading, setHistoryLoading] = useState(() => Number.isInteger(patientId) && patientId > 0);
  const [historyError, setHistoryError] = useState("");
  const [historyAttempt, setHistoryAttempt] = useState(0);
  const [uploading, setUploading] = useState(false);
  const inFlight = useRef(false);
  const poller = useRef<number | null>(null);
  const pollBusy = useRef(false);
  const navigated = useRef(false);
  const resumed = useRef(false);

  function stopPolling() {
    if (poller.current != null) {
      window.clearInterval(poller.current);
      poller.current = null;
    }
  }

  function openReview(consultationId: number) {
    if (navigated.current) return;
    navigated.current = true;
    stopPolling();
    const next = new URLSearchParams();
    if (Number.isInteger(visitId)) next.set("appointment_id", String(visitId));
    if (Number.isInteger(patientId) && patientId > 0) next.set("patient_id", String(patientId));
    if (patientName) next.set("patient_name", patientName);
    if (patientCode) next.set("patient_code", patientCode);
    if (queueToken) next.set("queue_token", queueToken);
    next.set("from_queue", fromQueue ? "1" : "0");
    navigate(`/doctor/consultations/${consultationId}/soap?${next.toString()}`);
  }

  function startPolling(consultationId: number) {
    stopPolling();
    const tick = async () => {
      if (pollBusy.current || navigated.current) return;
      pollBusy.current = true;
      try {
        const next = await getConsultationStatus(consultationId);
        const key = (next.status || "").toLowerCase();
        setStatus(next);
        setPhase(key);
        setMessage(next.progress_message || next.error_message || STATUS_TEXT[key] || "");
        if (!isTerminalConsultationStatus(key)) return;
        stopPolling();
        if (key === "pending_approval" || key === "completed") {
          if (next.soap_note?.trim()) openReview(consultationId);
          else {
            setPhase("error");
            setMessage("Processing finished but no SOAP note was returned. Please try again.");
          }
        }
      } catch (reason: unknown) {
        stopPolling();
        setPhase("error");
        setMessage(reason instanceof AppError ? reason.message : "Unable to check processing status.");
      } finally {
        pollBusy.current = false;
      }
    };
    void tick();
    poller.current = window.setInterval(() => void tick(), POLL_MS);
  }

  useEffect(() => {
    const id = Number.isInteger(patientId) && patientId > 0 ? patientId : null;
    if (!id) return;
    setHistoryLoading(true);
    setHistoryError("");
    getPatientHistory(id)
      .then((result) => {
        const current = result.visits.find((visit) => Number.isInteger(visitId) && visit.appointment_id === visitId);
        const currentStatus = (current?.consultation_status || "").toLowerCase();
        if (!resumed.current && current?.consultation_id && !(consultationParam > 0)) {
          resumed.current = true;
          if (currentStatus === "pending_approval" || currentStatus === "completed") {
            openReview(current.consultation_id);
          } else if (currentStatus && currentStatus !== "error" && currentStatus !== "rejected") {
            setPhase(currentStatus);
            startPolling(current.consultation_id);
          } else if (currentStatus === "error" || currentStatus === "rejected") {
            setPhase(currentStatus);
            setMessage(STATUS_TEXT[currentStatus]);
          }
        }
        const previous = result.visits.find((visit) => {
          if (Number.isInteger(visitId) && visit.appointment_id === visitId) return false;
          return (visit.consultation_status || "").toLowerCase() === "completed";
        });
        setHistory(previous ?? null);
      })
      .catch((reason: unknown) => {
        setHistory(null);
        setHistoryError(reason instanceof AppError ? reason.message : "Unable to load previous visit history.");
      })
      .finally(() => setHistoryLoading(false));
  }, [patientId, visitId, historyAttempt, consultationParam]);

  useEffect(() => {
    if (!Number.isInteger(consultationParam) || consultationParam <= 0 || resumed.current) return;
    resumed.current = true;
    setPhase("processing");
    startPolling(consultationParam);
  }, [consultationParam]);

  useEffect(() => () => stopPolling(), []);

  useEffect(() => {
    const busy = uploading || phase === "queued" || phase === "processing" || phase === "uploading";
    if (!busy) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [uploading, phase]);

  async function upload() {
    if (!file || inFlight.current) return;
    if (!Number.isInteger(visitId) || visitId <= 0) {
      setMessage("Open this page from Start consultation so the recording is linked to a visit.");
      setPhase("error");
      return;
    }
    const supabase = getSupabase();
    if (!supabase) {
      setPhase("error");
      setMessage("Audio storage is not configured. Set the Supabase URL and anon key for the web app.");
      return;
    }
    inFlight.current = true;
    navigated.current = false;
    setUploading(true);
    setPhase("uploading");
    setMessage(STATUS_TEXT.uploading);
    try {
      const extension = file.name.split(".").pop() || "mp3";
      const filePath = `consultations/${Date.now()}_consultation.${extension}`;
      const { error: storageError } = await supabase.storage.from("clinical-audios").upload(filePath, file, {
        contentType: file.type || "audio/mpeg",
        upsert: true,
      });
      if (storageError) throw new Error("Storage upload failed. Please try again.");
      const { data } = supabase.storage.from("clinical-audios").getPublicUrl(filePath);
      if (!data.publicUrl) throw new Error("The audio was uploaded, but its storage URL could not be retrieved.");
      setPhase("queued");
      setMessage(STATUS_TEXT.queued);
      const created = await processAudio({
        audio_url: data.publicUrl,
        audio_file_path: filePath,
        file_name: file.name,
        doctor_id: session?.doctor_id ?? null,
        appointment_id: visitId,
      });
      resumed.current = true;
      setStatus({ consultation_id: created.consultation_id, status: "queued" });
      const next = new URLSearchParams(params);
      next.set("consultation_id", String(created.consultation_id));
      navigate({ search: next.toString() }, { replace: true });
      startPolling(created.consultation_id);
    } catch (reason: unknown) {
      setPhase("error");
      setMessage(reason instanceof AppError ? reason.message : reason instanceof Error ? reason.message : "Unable to start audio processing. Please try again.");
    } finally {
      inFlight.current = false;
      setUploading(false);
    }
  }

  const busy = uploading || phase === "queued" || phase === "processing" || phase === "uploading";
  const key = phase.toLowerCase();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Record consultation"
        description={`${patientName} · ${patientCode}`}
        actions={<Link to={fromQueue ? "/doctor/queue" : "/doctor"} className="inline-flex min-h-10 items-center font-semibold text-primary-hover">Back</Link>}
      />
      {!Number.isInteger(visitId) || visitId <= 0 ? (
        <EmptyState title="Start from the queue" description="Open this screen via Start consultation so the audio is linked to a patient visit." action={<Link to="/doctor/queue" className="font-semibold text-primary-hover">Go to queue</Link>} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <div className="flex flex-col gap-4">
            <Card>
              <p className="text-sm text-muted">Visit</p>
              <p className="text-lg font-semibold">{patientName}</p>
              <p className="text-sm text-muted">Code: {patientCode}</p>
              {queueToken ? <div className="mt-2"><QueueToken token={queueToken} /></div> : null}
            </Card>
            <Card>
              <label htmlFor="consultation-audio" className="text-sm font-semibold">Audio file</label>
              <input
                id="consultation-audio"
                type="file"
                accept="audio/*"
                className="mt-2 block min-h-10 w-full text-base file:mr-3 file:min-h-10 file:rounded-md file:border file:border-line file:bg-surface file:px-3 file:font-semibold"
                disabled={busy}
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  if (phase === "error" || phase === "rejected") setPhase("idle");
                }}
              />
              <p className="mt-2 text-sm text-muted">Upload one consultation recording. Queued means processing has started, not that the note is ready.</p>
              {file && phase === "idle" && !historyLoading ? <Button className="mt-4" loading={uploading} disabled={busy} onClick={() => void upload()}>Upload and process</Button> : null}
              {phase === "error" || phase === "rejected" ? <Button className="mt-4" variant="secondary" onClick={() => { setPhase("idle"); setMessage(""); }}>Try again</Button> : null}
            </Card>
            {busy ? <Spinner label={STATUS_TEXT[key] || "Processing"} /> : null}
            {phase !== "idle" ? (
              <Alert title={STATUS_TEXT[key] || "Consultation status"} tone={key === "error" || key === "rejected" ? "danger" : key === "pending_approval" || key === "completed" ? "success" : "info"}>
                {message || status?.processing_step || key}
                {status?.progress_percent != null && busy ? ` · ${status.progress_percent}%` : ""}
              </Alert>
            ) : null}
            {phase !== "idle" && phase !== "error" && phase !== "rejected" ? (
              <ol className="flex flex-col gap-2" aria-label="Processing steps">
                {CHECKLIST.map((label, index) => {
                  const current = checklistIndex(phase, status?.processing_step);
                  const state = current >= CHECKLIST.length ? "done" : index < current ? "done" : index === current ? "current" : "pending";
                  return (
                    <li key={label} className={state === "pending" ? "text-sm text-muted" : "text-sm font-semibold text-ink"}>
                      {state === "done" ? "Done" : state === "current" ? "Current" : "Waiting"} · {label}
                    </li>
                  );
                })}
              </ol>
            ) : null}
          </div>
          <Card>
            <h2 className="text-lg font-semibold">Previous visit</h2>
            {historyLoading ? <Skeleton className="mt-3 h-20 w-full" /> : null}
            {historyError ? (
              <div className="mt-3">
                <ErrorState title="History unavailable" description={historyError} action={<Button variant="secondary" onClick={() => setHistoryAttempt((value) => value + 1)}>Retry</Button>} />
              </div>
            ) : null}
            {!historyLoading && !historyError && history ? (
              <div className="mt-3 text-sm">
                <p className="font-semibold">{formatAppointmentDateTime(history.scheduled_time)}</p>
                <p className="text-muted">{history.doctor_name || "Doctor"}</p>
                <p className="mt-2">{history.clinical_summary?.trim() || "No clinical summary for this visit."}</p>
                {Number.isInteger(patientId) && patientId > 0 ? (
                  <Link className="mt-3 inline-flex font-semibold text-primary-hover" to={`/doctor/patients/${patientId}/history?exclude_appointment_id=${visitId}`}>
                    View history
                  </Link>
                ) : null}
              </div>
            ) : null}
            {!historyLoading && !historyError && !history ? (
              <p className="mt-3 text-sm text-muted">No earlier completed visit for this patient.</p>
            ) : null}
          </Card>
        </div>
      )}
    </div>
  );
}
