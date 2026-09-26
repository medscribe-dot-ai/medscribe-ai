import { AppError } from "../api/errors";
import type { DuplicatePatient } from "../types/admin";

export function duplicatePatientFromError(error: unknown): DuplicatePatient | null {
  if (!(error instanceof AppError) || error.status !== 409 || !error.payload || typeof error.payload !== "object") {
    return null;
  }
  const detail = (error.payload as { detail?: unknown }).detail;
  if (!detail || typeof detail !== "object" || !("existing_patient" in detail)) {
    return null;
  }
  const existing = (detail as { existing_patient?: DuplicatePatient }).existing_patient;
  if (!existing || typeof existing.patient_id !== "number" || typeof existing.name !== "string") {
    return null;
  }
  return existing;
}
