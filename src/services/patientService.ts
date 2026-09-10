import axios from 'axios';
import { API_URL } from '../config/api';

/** Matches backend schemas.PatientListResponse from GET /patients */
export type PatientListItem = {
  patient_id: number;
  name: string;
  patient_code: string | null;
  age: number | null;
  phone: string | null;
  department: string | null;
  status: string | null;
  created_at: string | null;
  visit_count: number;
  latest_clinical_summary?: string | null;
};

/** Matches backend schemas.PatientHistorySoapSections */
export type PatientHistorySoapSections = {
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
};

/** Matches backend schemas.PatientHistoryVisit */
export type PatientHistoryVisit = {
  appointment_id: number;
  scheduled_time: string | null;
  doctor_id: number | null;
  doctor_name: string | null;
  status: string | null;
  queue_token: string | null;
  consultation_id: number | null;
  consultation_status: string | null;
  soap_note: string | null;
  soap_sections: PatientHistorySoapSections | null;
  clinical_summary?: string | null;
};

/** Matches backend schemas.PatientHistoryResponse */
export type PatientHistoryResponse = {
  patient_id: number;
  patient_name: string | null;
  patient_code: string | null;
  visits: PatientHistoryVisit[];
};

export async function getPatients(search: string = ''): Promise<PatientListItem[]> {
  const trimmed = search.trim();
  const res = await axios.get(`${API_URL}/patients`, {
    params: trimmed ? { search: trimmed } : undefined,
  });
  return (res.data || []) as PatientListItem[];
}

/** Lookup one patient from GET /patients (for header fields not on history). */
export async function getPatientById(patientId: string | number): Promise<PatientListItem | null> {
  const rows = await getPatients();
  const match = rows.find(
    (p) =>
      String(p.patient_id) === String(patientId) ||
      (p.patient_code != null && p.patient_code === String(patientId))
  );
  return match ?? null;
}

export async function getPatientHistory(
  patientId: string | number
): Promise<PatientHistoryResponse> {
  const id = String(patientId).trim();
  if (!id) {
    throw new Error('patient_id is required');
  }
  const res = await axios.get(`${API_URL}/patients/${id}/history`);
  const data = res.data as PatientHistoryResponse;
  return {
    patient_id: data.patient_id,
    patient_name: data.patient_name ?? null,
    patient_code: data.patient_code ?? null,
    visits: Array.isArray(data.visits) ? data.visits : [],
  };
}
