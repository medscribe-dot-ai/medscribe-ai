import { parseAppointmentInstant } from "../lib/clinicTime";
import type { AppointmentRow } from "../types/admin";

export function recordPath(item: AppointmentRow): string {
  const params = new URLSearchParams();
  if (item.patient_id != null) params.set("patient_id", String(item.patient_id));
  if (item.queue_token) params.set("queue_token", item.queue_token);
  if (item.patient_name) params.set("patient_name", item.patient_name);
  if (item.patient_code) params.set("patient_code", item.patient_code);
  params.set("from_queue", "1");
  const query = params.toString();
  return `/doctor/visits/${item.appointment_id}/record${query ? `?${query}` : ""}`;
}

function instant(iso: string | null | undefined) {
  const date = parseAppointmentInstant(iso);
  return date ? date.getTime() : Number.POSITIVE_INFINITY;
}

/** Prefer the current in-progress visit; otherwise the earliest waiting visit. */
export function selectNextAppointmentId(queue: AppointmentRow[]): number | null {
  const inProgress = queue
    .filter((row) => (row.status || "").toLowerCase() === "in_progress")
    .sort((a, b) => instant(a.scheduled_time) - instant(b.scheduled_time));
  if (inProgress.length > 0) return inProgress[0].appointment_id;
  const waiting = queue
    .filter((row) => (row.status || "").toLowerCase() === "waiting")
    .sort((a, b) => instant(a.scheduled_time) - instant(b.scheduled_time));
  return waiting[0]?.appointment_id ?? null;
}
