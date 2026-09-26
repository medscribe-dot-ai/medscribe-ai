/** Clinic wall clock is Asia/Karachi (no DST). Slot math matches src/utils/doctorSlots.ts. */
export const CLINIC_TIME_ZONE = "Asia/Karachi";
export const APPOINTMENT_SLOT_MINUTES = 30;
const CLINIC_FIXED_UTC_OFFSET = "+05:00";
const DAY_KEYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export type DoctorSchedule = Record<string, string>;

export type AppointmentSlot = {
  time: string;
  minutes: number;
  available: boolean;
  reason?: "past" | "outside_hours" | "booked";
};

const TIME_RANGE_REGEX =
  /^(0?[1-9]|1[0-2]):([0-5][0-9])\s?(AM|PM)\s*-\s*(0?[1-9]|1[0-2]):([0-5][0-9])\s?(AM|PM)$/i;

export function clinicToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CLINIC_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function clinicClock(now: Date): { hour: number; minute: number } | null {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: CLINIC_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const hourRaw = parts.find((part) => part.type === "hour")?.value;
  const minuteRaw = parts.find((part) => part.type === "minute")?.value;
  if (hourRaw == null || minuteRaw == null) return null;
  let hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  if (hour === 24) hour = 0;
  return { hour, minute };
}

export function clinicWallDateTimeToUtcIso(dateStr: string, timeHHMM: string): string | null {
  const date = dateStr.trim();
  const time = timeHHMM.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const instant = new Date(`${date}T${time}:00${CLINIC_FIXED_UTC_OFFSET}`);
  if (Number.isNaN(instant.getTime())) return null;
  return instant.toISOString();
}

export function addClinicDays(dateStr: string, days: number): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) return null;
  const [year, month, day] = dateStr.trim().split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatClinicDateLabel(dateStr: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) return dateStr;
  const [year, month, day] = dateStr.trim().split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function weekdayKeyFromDateStr(dateStr: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) return null;
  const [year, month, day] = dateStr.trim().split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) return null;
  return DAY_KEYS[date.getUTCDay()];
}

export function parseClockToMinutes(clock: string): number | null {
  const match = clock.trim().match(/^(0?[1-9]|1[0-2]):([0-5][0-9])\s?(AM|PM)$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const period = match[3].toUpperCase();
  if (period === "AM") {
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
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function formatMinutesToDisplay(totalMinutes: number): string {
  const hour24 = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  const period = hour24 >= 12 ? "PM" : "AM";
  let hour12 = hour24 % 12;
  if (hour12 === 0) hour12 = 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
}

export function buildSlotsForDate(
  schedule: DoctorSchedule | null | undefined,
  dateStr: string,
  now: Date = new Date(),
  slotMinutes: number = APPOINTMENT_SLOT_MINUTES,
): AppointmentSlot[] {
  const dayKey = weekdayKeyFromDateStr(dateStr);
  if (!dayKey || !schedule) return [];
  const rangeStr = schedule[dayKey];
  if (!rangeStr || !String(rangeStr).trim()) return [];
  const range = parseScheduleRange(String(rangeStr));
  if (!range) return [];

  const clock = clinicClock(now);
  const isToday = dateStr.trim() === clinicToday(now);
  const nowMinutes = clock ? clock.hour * 60 + clock.minute : 0;
  const slots: AppointmentSlot[] = [];
  for (let time = range.start; time + slotMinutes <= range.end; time += slotMinutes) {
    const past = isToday && time <= nowMinutes;
    slots.push({
      time: formatMinutesToHHMM(time),
      minutes: time,
      available: !past,
      reason: past ? "past" : undefined,
    });
  }
  return slots;
}

export function markBookedSlots(slots: AppointmentSlot[], bookedTimesHHMM: Iterable<string>): AppointmentSlot[] {
  const booked = new Set(Array.from(bookedTimesHHMM).map((time) => String(time).trim()).filter(Boolean));
  if (booked.size === 0) return slots;
  return slots.map((slot) => (booked.has(slot.time) ? { ...slot, available: false, reason: "booked" as const } : slot));
}

export function isDoctorWorkingAt(
  schedule: DoctorSchedule | null | undefined,
  dateStr: string,
  now: Date = new Date(),
): boolean {
  const dayKey = weekdayKeyFromDateStr(dateStr);
  if (!dayKey || !schedule) return false;
  const rangeStr = schedule[dayKey];
  if (!rangeStr || !String(rangeStr).trim()) return false;
  const range = parseScheduleRange(String(rangeStr));
  if (!range) return false;
  if (dateStr.trim() !== clinicToday(now)) return true;
  const clock = clinicClock(now);
  if (!clock) return false;
  const nowMinutes = clock.hour * 60 + clock.minute;
  return nowMinutes >= range.start && nowMinutes < range.end;
}

export function getScheduleRangeLabel(schedule: DoctorSchedule | null | undefined, dateStr: string): string | null {
  const dayKey = weekdayKeyFromDateStr(dateStr);
  if (!dayKey || !schedule) return null;
  const rangeStr = schedule[dayKey];
  if (!rangeStr || !String(rangeStr).trim()) return null;
  return String(rangeStr).trim();
}

export function isDoctorScheduledOnDate(schedule: DoctorSchedule | null | undefined, dateStr: string): boolean {
  return Boolean(getScheduleRangeLabel(schedule, dateStr));
}

export function parseAppointmentInstant(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const raw = String(iso).trim();
  if (!raw) return null;
  let normalized = raw;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(raw) && !/[zZ]$|[+-]\d{2}:?\d{2}$/.test(raw)) {
    normalized = `${raw}Z`;
  }
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatAppointmentTime(iso: string | null | undefined): string {
  const date = parseAppointmentInstant(iso);
  if (!date) return "—";
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: CLINIC_TIME_ZONE,
  });
}

export function formatAppointmentDateTime(iso: string | null | undefined): string {
  const date = parseAppointmentInstant(iso);
  if (!date) return "—";
  return date.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: CLINIC_TIME_ZONE,
  });
}

export function scheduledTimeToSlotHHMM(
  iso: string | null | undefined,
  slotMinutes: number = APPOINTMENT_SLOT_MINUTES,
): string | null {
  const date = parseAppointmentInstant(iso);
  if (!date) return null;
  const clock = clinicClock(date);
  if (!clock) return null;
  const total = clock.hour * 60 + clock.minute;
  const snapped = Math.floor(total / slotMinutes) * slotMinutes;
  return formatMinutesToHHMM(snapped);
}

export function formatRelativeTime(iso: string | null | undefined, now: Date = new Date()): string {
  const date = parseAppointmentInstant(iso);
  if (!date) return "—";
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.floor(hours / 24)} day(s) ago`;
}
