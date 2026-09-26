import { apiClient } from "../api/client";
import type {
  PatientHistory,
  PatientListItem,
  PatientRegisterInput,
  RecentPatient,
  RegisteredPatient,
} from "../types/admin";

export async function listPatients(search = ""): Promise<PatientListItem[]> {
  const trimmed = search.trim();
  const response = await apiClient.get<PatientListItem[]>("/patients", {
    params: trimmed ? { search: trimmed } : undefined,
  });
  return Array.isArray(response.data) ? response.data : [];
}

export async function getPatientFromList(patientId: number): Promise<PatientListItem | null> {
  const rows = await listPatients();
  return rows.find((row) => row.patient_id === patientId) ?? null;
}

export async function listRecentPatients(limit = 5): Promise<RecentPatient[]> {
  const response = await apiClient.get<RecentPatient[]>("/patients/recent", { params: { limit } });
  return Array.isArray(response.data) ? response.data : [];
}

export async function registerPatient(input: PatientRegisterInput): Promise<RegisteredPatient> {
  const response = await apiClient.post<RegisteredPatient>("/receptionist/register-patient", input);
  return response.data;
}

export async function getPatientHistory(patientId: number): Promise<PatientHistory> {
  const response = await apiClient.get<PatientHistory>(`/patients/${patientId}/history`);
  return {
    patient_id: response.data.patient_id,
    patient_name: response.data.patient_name ?? null,
    patient_code: response.data.patient_code ?? null,
    visits: Array.isArray(response.data.visits) ? response.data.visits : [],
  };
}
