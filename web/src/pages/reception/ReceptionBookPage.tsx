import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AppError } from "../../api/errors";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Dialog } from "../../components/ui/Dialog";
import { EmptyState } from "../../components/ui/EmptyState";
import { FieldError } from "../../components/ui/FieldError";
import { Label } from "../../components/ui/Label";
import { PageHeader } from "../../components/ui/PageHeader";
import { QueueToken } from "../../components/ui/QueueToken";
import { Textarea } from "../../components/ui/Textarea";
import {
  APPOINTMENT_SLOT_MINUTES,
  addClinicDays,
  buildSlotsForDate,
  clinicToday,
  clinicWallDateTimeToUtcIso,
  formatAppointmentDateTime,
  formatClinicDateLabel,
  formatMinutesToDisplay,
  getScheduleRangeLabel,
  isDoctorScheduledOnDate,
  isDoctorWorkingAt,
  markBookedSlots,
  scheduledTimeToSlotHHMM,
  type AppointmentSlot,
  type DoctorSchedule,
} from "../../lib/clinicTime";
import { printQueueToken } from "../../lib/printQueueToken";
import { useToast } from "../../components/ui/useToast";
import { createAppointment, listAppointmentsByDate } from "../../services/appointmentService";
import { getDoctor, listDoctors } from "../../services/doctorService";
import type { AppointmentRow, DoctorSummary } from "../../types/admin";

const DEPT_ALL = "__ALL__";
const ACTIVE_BOOKING_STATUSES = new Set(["scheduled", "waiting", "in_progress", "completed"]);

export function ReceptionBookPage() {
  const [params] = useSearchParams();
  const { push } = useToast();
  const patientId = Number(params.get("patient_id"));
  const patientName = params.get("name") || "Patient";
  const patientCode = params.get("patient_code") || "—";
  const hasPatient = Number.isInteger(patientId) && patientId > 0;

  const [doctors, setDoctors] = useState<DoctorSummary[]>([]);
  const [schedules, setSchedules] = useState<Record<number, DoctorSchedule>>({});
  const [dayAppointments, setDayAppointments] = useState<AppointmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [slotError, setSlotError] = useState("");
  const [visitType, setVisitType] = useState<"waiting" | "scheduled">("waiting");
  const [dateStr, setDateStr] = useState(() => addClinicDays(clinicToday(), 1) || clinicToday());
  const [department, setDepartment] = useState(DEPT_ALL);
  const [complaint, setComplaint] = useState("");
  const [selectedDoctorId, setSelectedDoctorId] = useState<number | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [expandedDoctorId, setExpandedDoctorId] = useState<number | null>(null);
  const [fieldError, setFieldError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [booked, setBooked] = useState<AppointmentRow | null>(null);
  const [now, setNow] = useState(() => new Date());
  const inFlight = useRef(false);

  const effectiveDate = visitType === "waiting" ? clinicToday(now) : dateStr;

  const loadDoctors = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const list = await listDoctors();
      setDoctors(list);
      const entries = await Promise.all(
        list.map(async (doctor) => {
          try {
            const detail = await getDoctor(doctor.doctor_id);
            return [doctor.doctor_id, detail.schedule] as const;
          } catch {
            return [doctor.doctor_id, {} as DoctorSchedule] as const;
          }
        }),
      );
      const map: Record<number, DoctorSchedule> = {};
      for (const [id, schedule] of entries) map[id] = schedule;
      setSchedules(map);
    } catch (reason: unknown) {
      setDoctors([]);
      setSchedules({});
      setLoadError(reason instanceof AppError ? reason.message : "Could not load doctors. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDay = useCallback(async (date: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setDayAppointments([]);
      return;
    }
    try {
      setDayAppointments(await listAppointmentsByDate(date));
      setSlotError("");
    } catch (reason: unknown) {
      setSlotError(reason instanceof AppError ? reason.message : "Could not load booked slots. Please try again before booking.");
    }
  }, []);

  useEffect(() => {
    if (hasPatient) void loadDoctors();
  }, [hasPatient, loadDoctors]);

  useEffect(() => {
    if (hasPatient) void loadDay(effectiveDate);
  }, [hasPatient, effectiveDate, loadDay]);

  useEffect(() => {
    if (visitType !== "waiting") return;
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, [visitType]);

  useEffect(() => {
    setSelectedDoctorId(null);
    setSelectedSlot(null);
    setExpandedDoctorId(null);
    setFieldError("");
  }, [visitType, effectiveDate, department]);

  const departments = useMemo(() => {
    const values = new Set<string>();
    for (const doctor of doctors) {
      const spec = (doctor.specialization || "").trim();
      if (spec) values.add(spec);
    }
    return Array.from(values).sort((a, b) => {
      const aGeneral = /general/i.test(a) ? 0 : 1;
      const bGeneral = /general/i.test(b) ? 0 : 1;
      if (aGeneral !== bGeneral) return aGeneral - bGeneral;
      return a.localeCompare(b);
    });
  }, [doctors]);

  const filteredDoctors = useMemo(() => {
    if (department === DEPT_ALL) return doctors;
    return doctors.filter((doctor) => (doctor.specialization || "").trim().toLowerCase() === department.toLowerCase());
  }, [doctors, department]);

  function slotsFor(doctorId: number): AppointmentSlot[] {
    const bookedTimes = dayAppointments
      .filter((row) => row.doctor_id === doctorId && ACTIVE_BOOKING_STATUSES.has((row.status || "").toLowerCase()))
      .map((row) => scheduledTimeToSlotHHMM(row.scheduled_time))
      .filter((time): time is string => Boolean(time));
    return markBookedSlots(buildSlotsForDate(schedules[doctorId] || {}, effectiveDate, now), bookedTimes);
  }

  function firstOpenSlot(doctorId: number) {
    return slotsFor(doctorId).find((slot) => slot.available)?.time ?? null;
  }

  function selectable(doctorId: number) {
    const schedule = schedules[doctorId] || {};
    const scheduled = isDoctorScheduledOnDate(schedule, effectiveDate);
    const onDuty = visitType === "waiting" ? isDoctorWorkingAt(schedule, effectiveDate, now) : scheduled;
    const open = slotsFor(doctorId).some((slot) => slot.available);
    return scheduled && open && (visitType === "scheduled" || onDuty);
  }

  async function book() {
    if (!hasPatient) {
      setFieldError("Select a patient before booking.");
      return;
    }
    if (slotError) {
      setFieldError("Booked slots could not be loaded. Refresh them before booking.");
      return;
    }
    if (!selectedDoctorId || !selectable(selectedDoctorId)) {
      setFieldError(visitType === "waiting" ? "Select an available doctor." : "Select an available doctor and time slot.");
      return;
    }
    const slot = visitType === "waiting" ? firstOpenSlot(selectedDoctorId) : selectedSlot;
    if (!slot || (visitType === "scheduled" && !slotsFor(selectedDoctorId).some((item) => item.time === slot && item.available))) {
      setFieldError(visitType === "waiting" ? "No open slot available for this doctor today." : "Select an available time slot.");
      return;
    }
    const scheduledTime = clinicWallDateTimeToUtcIso(effectiveDate, slot);
    if (!scheduledTime) {
      setFieldError("Please choose a valid slot.");
      return;
    }
    if (inFlight.current) return;
    inFlight.current = true;
    setSubmitting(true);
    setFieldError("");
    try {
      const created = await createAppointment({
        patient_id: patientId,
        doctor_id: selectedDoctorId,
        scheduled_time: scheduledTime,
        status: visitType,
      });
      setBooked(created);
      setSelectedDoctorId(null);
      setSelectedSlot(null);
      await loadDay(effectiveDate);
    } catch (reason: unknown) {
      setFieldError(reason instanceof AppError ? reason.message : "Unable to book appointment. Please check the details and try again.");
      await loadDay(effectiveDate);
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  if (!hasPatient) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Book appointment" />
        <EmptyState title="Select a patient before booking" description="Appointment booking starts from the patient list." action={<Link to="/reception/patients" className="font-semibold text-primary-hover">Go to patients</Link>} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Book appointment" description={`${patientName} · ${patientCode}`} />
      {loadError ? <Alert title="Could not load doctors" tone="danger">{loadError}</Alert> : null}
      {slotError ? <Alert title="Booked slots could not be refreshed" tone="danger">{slotError}</Alert> : null}
      {fieldError ? <Alert title="Booking needs attention" tone="danger">{fieldError}</Alert> : null}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="flex flex-col gap-4">
          <Card>
            <p className="text-sm font-semibold text-muted">Patient</p>
            <p className="text-lg font-semibold">{patientName}</p>
            <p className="text-sm text-muted">Code: {patientCode}</p>
          </Card>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant={visitType === "waiting" ? "primary" : "secondary"} onClick={() => setVisitType("waiting")}>Current OPD</Button>
            <Button
              variant={visitType === "scheduled" ? "primary" : "secondary"}
              onClick={() => {
                setVisitType("scheduled");
                setDateStr((current) => (current > clinicToday() ? current : addClinicDays(clinicToday(), 1) || current));
              }}
            >
              Future appointment
            </Button>
          </div>
          <div>
            <Label htmlFor="visit-date">Date</Label>
            {visitType === "waiting" ? (
              <p className="rounded-md border border-line bg-background px-3 py-2 text-sm">{formatClinicDateLabel(clinicToday())}. Today is locked for Current OPD.</p>
            ) : (
              <input
                id="visit-date"
                type="date"
                className="min-h-10 w-full rounded-md border border-line bg-surface px-3 text-base"
                min={addClinicDays(clinicToday(), 1) || undefined}
                value={dateStr}
                onChange={(event) => {
                  const next = event.target.value;
                  if (next > clinicToday()) setDateStr(next);
                }}
              />
            )}
          </div>
          <div>
            <Label htmlFor="complaint">Chief complaint</Label>
            <Textarea id="complaint" value={complaint} onChange={(event) => setComplaint(event.target.value)} placeholder='e.g. "Dil mein dard hai"' />
            <p className="mt-1 text-sm text-muted">Enter the complaint, then pick a department manually. No automatic diagnosis. This note is not saved.</p>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold">Department / specialty</p>
            <div className="flex flex-wrap gap-2">
              <Button variant={department === DEPT_ALL ? "primary" : "secondary"} onClick={() => setDepartment(DEPT_ALL)}>All / Any</Button>
              {departments.map((item) => (
                <Button key={item} variant={department === item ? "primary" : "secondary"} onClick={() => setDepartment(item)}>{item}</Button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">{visitType === "waiting" ? "Doctor" : `Doctors and slots (${APPOINTMENT_SLOT_MINUTES} min)`}</h2>
          {loading ? <p className="text-sm text-muted">Loading doctors and schedules.</p> : null}
          {!loading && filteredDoctors.length === 0 ? (
            <EmptyState title={doctors.length === 0 ? "No doctors available." : "No doctors in this department."} action={loadError ? <Button variant="secondary" onClick={() => void loadDoctors()}>Retry</Button> : undefined} />
          ) : null}
          {filteredDoctors.map((doctor) => {
            const schedule = schedules[doctor.doctor_id] || {};
            const scheduled = isDoctorScheduledOnDate(schedule, effectiveDate);
            const onDuty = visitType === "waiting" ? isDoctorWorkingAt(schedule, effectiveDate, now) : scheduled;
            const slots = slotsFor(doctor.doctor_id);
            const openCount = slots.filter((slot) => slot.available).length;
            const unavailable = !scheduled || (visitType === "waiting" && !onDuty) || openCount === 0;
            const selected = visitType === "waiting" ? selectedDoctorId === doctor.doctor_id : selectedDoctorId === doctor.doctor_id && Boolean(selectedSlot);
            const range = getScheduleRangeLabel(schedule, effectiveDate);
            let status = "Available";
            if (!scheduled) status = "Off day";
            else if (visitType === "waiting" && !onDuty) status = "Outside hours";
            else if (openCount === 0) status = "No open slots";
            else if (visitType === "waiting") status = selected ? "Joins queue now" : "Available now";
            return (
              <Card key={doctor.doctor_id} className={unavailable ? "opacity-70" : selected ? "border-primary" : undefined}>
                <button
                  type="button"
                  className="flex w-full items-start justify-between gap-3 text-left"
                  disabled={visitType === "waiting" && unavailable}
                  onClick={() => {
                    if (visitType === "waiting") {
                      if (unavailable) return;
                      setSelectedDoctorId(doctor.doctor_id);
                      setSelectedSlot(null);
                      setFieldError("");
                      return;
                    }
                    setExpandedDoctorId((current) => (current === doctor.doctor_id ? null : doctor.doctor_id));
                  }}
                >
                  <span>
                    <span className="block font-semibold">{doctor.name}</span>
                    <span className="block text-sm text-muted">{doctor.specialization?.trim() || "Not specified"}{range ? ` · ${range}` : ""}</span>
                    <span className="mt-1 block text-sm font-semibold">{status}{visitType === "scheduled" && scheduled ? ` · ${openCount} open` : ""}</span>
                  </span>
                </button>
                {visitType === "scheduled" && expandedDoctorId === doctor.doctor_id ? (
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {!scheduled ? <p className="col-span-full text-sm text-muted">Doctor is not scheduled on this day.</p> : null}
                    {scheduled && slots.length === 0 ? <p className="col-span-full text-sm text-muted">No slots fit this schedule window.</p> : null}
                    {slots.map((slot) => (
                      <button
                        key={slot.time}
                        type="button"
                        disabled={!slot.available}
                        className={`min-h-10 rounded-md border px-2 text-sm font-semibold ${selectedDoctorId === doctor.doctor_id && selectedSlot === slot.time ? "border-primary-hover bg-mint text-primary-hover" : "border-line bg-surface"} disabled:text-muted`}
                        onClick={() => {
                          setSelectedDoctorId(doctor.doctor_id);
                          setSelectedSlot(slot.time);
                          setFieldError("");
                        }}
                      >
                        {formatMinutesToDisplay(slot.minutes)}
                        {!slot.available ? ` · ${slot.reason === "booked" ? "Booked" : "Past"}` : ""}
                      </button>
                    ))}
                  </div>
                ) : null}
              </Card>
            );
          })}
          {fieldError ? <FieldError>{fieldError}</FieldError> : null}
          <Button loading={submitting} onClick={() => void book()}>Book appointment</Button>
        </div>
      </div>
      <Dialog open={Boolean(booked)} title="Appointment booked" onClose={() => setBooked(null)}>
        {booked ? (
          <div className="flex flex-col gap-2">
            <p>{booked.patient_name || patientName} · {formatAppointmentDateTime(booked.scheduled_time)}</p>
            <p>Doctor: {booked.doctor_name || "—"}</p>
            <p>Status: {(booked.status || "").replaceAll("_", " ")}</p>
            {booked.queue_token ? <QueueToken token={booked.queue_token} /> : <p className="text-sm text-muted">No queue token until check-in.</p>}
            {booked.queue_token ? (
              <Button
                variant="secondary"
                onClick={() => {
                  const message = printQueueToken(booked);
                  if (message) push(message, "warning");
                }}
              >
                Print token
              </Button>
            ) : null}
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
