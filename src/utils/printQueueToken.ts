import { Alert, Share } from 'react-native';

export type QueueTokenPrintData = {
  patient_name: string | null | undefined;
  patient_code: string | null | undefined;
  queue_token: string | null | undefined;
  scheduled_time: string | null | undefined;
  doctor_name: string | null | undefined;
};

const formatWhen = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/** Plain-text slip for share / print-preview (no printer SDK required). */
export function formatQueueTokenSlip(data: QueueTokenPrintData): string {
  return [
    'MedScribe AI — Queue Token',
    '----------------------------',
    `Patient: ${data.patient_name || '—'}`,
    `Patient Code: ${data.patient_code || '—'}`,
    `Queue Token: ${data.queue_token || '—'}`,
    `Appointment: ${formatWhen(data.scheduled_time)}`,
    `Doctor: ${data.doctor_name || '—'}`,
    '----------------------------',
  ].join('\n');
}

/**
 * Opens the OS share sheet with a printable token slip.
 * On phone/tablet the user can Print, Save, or send from there.
 */
export async function printQueueToken(data: QueueTokenPrintData): Promise<void> {
  const token = data.queue_token?.trim();
  if (!token) {
    Alert.alert('No Queue Token', 'This appointment does not have a queue token yet.');
    return;
  }

  try {
    await Share.share({
      message: formatQueueTokenSlip({ ...data, queue_token: token }),
      title: `Queue Token ${token}`,
    });
  } catch {
    Alert.alert('Share Failed', 'Could not open the share/print sheet. Please try again.');
  }
}
