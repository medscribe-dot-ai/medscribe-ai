/**
 * Slot helpers for doctor schedules stored as:
 * { "Mon": "09:00 AM - 05:00 PM", ... }
 * via GET /doctors/{doctor_id} → schedule
 *
 * No project-wide slot duration exists; 30 minutes matches typical OPD steps.
 */

export const APPOINTMENT_SLOT_MINUTES = 30;

/** Matches backend CLINIC_TZ default (Asia/Karachi). */
export const CLINIC_TIME_ZONE = 'Asia/Karachi';

const DAY_KEYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export type DoctorSchedule = Record<string, string>;

export type AppointmentSlot = {
  /** Local wall time HH:MM (24h) */
  time: string;
  /** Minutes from midnight */
  minutes: number;
  /** Selectable for booking */
  available: boolean;
  /** Why disabled, if any */
  reason?: 'past' | 'outside_hours' | 'booked';
};

const TIME_RANGE_REGEX =
  /^(0?[1-9]|1[0-2]):([0-5][0-9])\s?(AM|PM)\s*-\s*(0?[1-9]|1[0-2]):([0-5][0-9])\s?(AM|PM)$/i;

export function weekdayKeyFromDateStr(dateStr: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) return null;
  const [y, m, d] = dateStr.trim().split('-').map(Number);
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return null;
  return DAY_KEYS[date.getDay()];
}

/** Parse "09:00 AM" → minutes from midnight */
export function parseClockToMinutes(clock: string): number | null {
  const m = clock.trim().match(/^(0?[1-9]|1[0-2]):([0-5][0-9])\s?(AM|PM)$/i);
  if (!m) return null;
  let hour = Number(m[1]);
  const minute = Number(m[2]);
  const period = m[3].toUpperCase();
  if (period === 'AM') {
    if (hour === 12) hour = 0;
  } else if (hour !== 12) {
    hour += 12;
  }
  return hour * 60 + minute;
}

export function parseScheduleRange(range: string): { start: number; end: number } | null {
  const trimmed = range.trim();
  if (!TIME_RANGE_REGEX.test(trimmed)) return null;
  const parts = trimmed.split(/\s*-\s*/);
  if (parts.length !== 2) return null;
  const start = parseClockToMinutes(parts[0]);
  const end = parseClockToMinutes(parts[1]);
  if (start === null || end === null || end <= start) return null;
  return { start, end };
}

export function formatMinutesToHHMM(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatMinutesToDisplay(totalMinutes: number): string {
  const h24 = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const period = h24 >= 12 ? 'PM' : 'AM';
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

function isSameLocalDate(dateStr: string, now: Date): boolean {
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;
  return dateStr.trim() === today;
}

/**
 * Build slots for a date from the doctor's weekday schedule range.
 * - Off day / invalid range → []
 * - Slots only inside working hours (step = APPOINTMENT_SLOT_MINUTES)
 * - Today: past slot starts are marked available=false
 */
export function buildSlotsForDate(
  schedule: DoctorSchedule | null | undefined,
  dateStr: string,
  now: Date = new Date(),
  slotMinutes: number = APPOINTMENT_SLOT_MINUTES
): AppointmentSlot[] {
  const dayKey = weekdayKeyFromDateStr(dateStr);
  if (!dayKey || !schedule) return [];

  const rangeStr = schedule[dayKey];
  if (!rangeStr || !String(rangeStr).trim()) return [];

  const range = parseScheduleRange(String(rangeStr));
  if (!range) return [];

  const slots: AppointmentSlot[] = [];
  const isToday = isSameLocalDate(dateStr, now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  for (let t = range.start; t + slotMinutes <= range.end; t += slotMinutes) {
    const past = isToday && t <= nowMinutes;
    slots.push({
      time: formatMinutesToHHMM(t),
      minutes: t,
      available: !past,
      reason: past ? 'past' : undefined,
    });
  }

  return slots;
}

/**
 * Mark slots whose HH:MM matches an existing (non-cancelled) appointment.
 * Does not regenerate the schedule grid — overlays occupancy on Step 1 slots.
 */
export function markBookedSlots(
  slots: AppointmentSlot[],
  bookedTimesHHMM: Iterable<string>
): AppointmentSlot[] {
  const booked = new Set(
    Array.from(bookedTimesHHMM)
      .map((t) => String(t).trim())
      .filter(Boolean)
  );
  if (booked.size === 0) return slots;

  return slots.map((slot) => {
    if (!booked.has(slot.time)) return slot;
    return {
      ...slot,
      available: false,
      reason: 'booked',
    };
  });
}

/** True if the doctor has a valid schedule range covering `now` on `dateStr`. */
export function isDoctorWorkingAt(
  schedule: DoctorSchedule | null | undefined,
  dateStr: string,
  now: Date = new Date()
): boolean {
  const dayKey = weekdayKeyFromDateStr(dateStr);
  if (!dayKey || !schedule) return false;
  const rangeStr = schedule[dayKey];
  if (!rangeStr || !String(rangeStr).trim()) return false;
  const range = parseScheduleRange(String(rangeStr));
  if (!range) return false;

  if (!isSameLocalDate(dateStr, now)) {
    // Future/past calendar day: "working that day" = has a schedule for the weekday
    return true;
  }
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return nowMinutes >= range.start && nowMinutes < range.end;
}

/** Weekday range label e.g. "09:00 AM - 05:00 PM", or null if off day. */
export function getScheduleRangeLabel(
  schedule: DoctorSchedule | null | undefined,
  dateStr: string
): string | null {
  const dayKey = weekdayKeyFromDateStr(dateStr);
  if (!dayKey || !schedule) return null;
  const rangeStr = schedule[dayKey];
  if (!rangeStr || !String(rangeStr).trim()) return null;
  return String(rangeStr).trim();
}

/** Whether the doctor has any schedule entry for that calendar weekday. */
export function isDoctorScheduledOnDate(
  schedule: DoctorSchedule | null | undefined,
  dateStr: string
): boolean {
  return Boolean(getScheduleRangeLabel(schedule, dateStr));
}

/**
 * Backend persists UTC wall time as a naive ISO string (no Z).
 * Without normalization, JS treats that as local time and shifts the clock
 * (e.g. 09:30 PK → stored 04:30 UTC → shown as 4:30).
 */
export function parseAppointmentInstant(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const raw = String(iso).trim();
  if (!raw) return null;

  let normalized = raw;
  // Naive "YYYY-MM-DDTHH:MM[:SS[.fff]]" → treat as UTC
  if (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(raw) &&
    !/[zZ]$|[+-]\d{2}:?\d{2}$/.test(raw)
  ) {
    normalized = `${raw}Z`;
  }

  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

function clinicHoursMinutes(d: Date): { hour: number; minute: number } | null {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: CLINIC_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d);
  const hourRaw = parts.find((p) => p.type === 'hour')?.value;
  const minuteRaw = parts.find((p) => p.type === 'minute')?.value;
  if (hourRaw == null || minuteRaw == null) return null;
  let hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  // Some engines emit "24" for midnight
  if (hour === 24) hour = 0;
  return { hour, minute };
}

/** Clinic-local wall clock for appointment timestamps. */
export function formatAppointmentTime(iso: string | null | undefined): string {
  const d = parseAppointmentInstant(iso);
  if (!d) return '—';
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: CLINIC_TIME_ZONE,
  });
}

/** Clinic-local date + time for appointment timestamps. */
export function formatAppointmentDateTime(iso: string | null | undefined): string {
  const d = parseAppointmentInstant(iso);
  if (!d) return '—';
  return d.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: CLINIC_TIME_ZONE,
  });
}

/** Clinic-local HH:MM snapped down to the slot grid (for matching API scheduled_time). */
export function scheduledTimeToSlotHHMM(
  iso: string | null | undefined,
  slotMinutes: number = APPOINTMENT_SLOT_MINUTES
): string | null {
  const d = parseAppointmentInstant(iso);
  if (!d) return null;
  const hm = clinicHoursMinutes(d);
  if (!hm) return null;
  const total = hm.hour * 60 + hm.minute;
  const snapped = Math.floor(total / slotMinutes) * slotMinutes;
  return formatMinutesToHHMM(snapped);
}
