import { formatAppointmentDateTime } from "./clinicTime";

export type QueueTokenPrintData = {
  patient_name: string | null | undefined;
  patient_code: string | null | undefined;
  queue_token: string | null | undefined;
  scheduled_time: string | null | undefined;
  doctor_name: string | null | undefined;
  department?: string | null | undefined;
};

export function formatQueueTokenSlip(data: QueueTokenPrintData): string {
  const department = (data.department || "").trim() || "Not specified";
  return [
    "MedScribe AI — Queue Token",
    "----------------------------",
    `Patient: ${data.patient_name || "—"}`,
    `Patient Code: ${data.patient_code || "—"}`,
    `Queue Token: ${data.queue_token || "—"}`,
    `Appointment: ${formatAppointmentDateTime(data.scheduled_time)}`,
    `Doctor: ${data.doctor_name?.trim() || "—"}`,
    `Department: ${department}`,
    "----------------------------",
  ].join("\n");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/** Opens a printable slip. Returns a user-facing message when printing cannot start. */
export function printQueueToken(data: QueueTokenPrintData): string | null {
  const token = data.queue_token?.trim();
  if (!token) {
    return "This appointment does not have a queue token yet.";
  }
  const slip = formatQueueTokenSlip({ ...data, queue_token: token });
  const popup = window.open("", "_blank", "noopener,noreferrer,width=480,height=640");
  if (!popup) {
    return "Allow pop-ups to print the queue token.";
  }
  popup.document.write(
    `<!doctype html><title>Queue Token ${escapeHtml(token)}</title><pre style="font:16px/1.5 sans-serif;padding:24px">${escapeHtml(slip)}</pre><script>window.print()</script>`,
  );
  popup.document.close();
  return null;
}
