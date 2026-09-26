const NAME_REGEX = /^[A-Za-z.\s]{3,50}$/;
const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^(\+92|0)[0-9]{10}$/;
const TIME_RANGE_REGEX = /^(0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM)\s*-\s*(0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM)$/i;

export const DOCTOR_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export const SPECIALIZATIONS: string[] = ["Cardiologist", "Dermatologist", "Neurologist", "Pediatrician", "General Physician", "Surgeon"];

export function validateName(value: string) {
  if (!value.trim()) return "Full name is required.";
  if (!NAME_REGEX.test(value.trim())) return "Name must be 3-50 letters.";
  return "";
}

export function validateUsername(value: string) {
  if (!value.trim()) return "Username is required.";
  if (!USERNAME_REGEX.test(value.trim())) return "Use 3-20 lowercase letters, numbers, or underscores.";
  return "";
}

export function validateEmail(value: string) {
  if (!value.trim()) return "Email is required.";
  if (!EMAIL_REGEX.test(value.trim())) return "Enter a valid email address.";
  return "";
}

export function validatePhone(value: string) {
  const cleaned = value.trim().replace(/[\s-]/g, "");
  if (!cleaned) return "Contact number is required.";
  if (!PHONE_REGEX.test(cleaned)) return "Use 03XXXXXXXXX or +92XXXXXXXXXX.";
  return "";
}

export function validatePassword(value: string, required: boolean) {
  if (!value.trim()) return required ? "Password is required." : "";
  if (value.length < 6) return "Password must be at least 6 characters.";
  return "";
}

export function validateExperience(value: string) {
  if (!value.trim()) return "";
  const num = Number(value);
  if (Number.isNaN(num) || !Number.isInteger(num)) return "Experience must be a whole number.";
  if (num < 0 || num > 60) return "Enter a value from 0 to 60.";
  return "";
}

export function validateSchedule(schedule: Record<string, string>) {
  const days = Object.keys(schedule);
  if (days.length === 0) return "Select at least one working day.";
  for (const day of days) {
    const time = schedule[day]?.trim() ?? "";
    if (!TIME_RANGE_REGEX.test(time)) return `Use a time like 09:00 AM - 05:00 PM for ${day}.`;
  }
  return "";
}

export function cleanPhone(value: string) {
  return value.trim().replace(/[\s-]/g, "");
}
