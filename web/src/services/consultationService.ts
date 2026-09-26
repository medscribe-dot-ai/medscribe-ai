import { apiClient } from "../api/client";

export type ConsultationStatus = {
  consultation_id: number;
  status: string;
  file_name?: string | null;
  error_message?: string | null;
  soap_note?: string | null;
  transcript?: string | null;
  processing_step?: string | null;
  progress_message?: string | null;
  progress_percent?: number | null;
  appointment_id?: number | null;
};

export type ProcessAudioInput = {
  audio_url: string;
  audio_file_path: string;
  file_name: string;
  doctor_id: number | null;
  appointment_id: number | null;
};

const TERMINAL = new Set(["pending_approval", "completed", "error", "rejected"]);

export function isTerminalConsultationStatus(status: string | null | undefined) {
  return TERMINAL.has((status || "").toLowerCase());
}

export async function processAudio(input: ProcessAudioInput): Promise<{ consultation_id: number; status: string }> {
  const response = await apiClient.post<{ consultation_id?: number; status?: string }>("/consultation/process-audio", input);
  if (typeof response.data.consultation_id !== "number") {
    throw new Error("The consultation could not be created. Please try again.");
  }
  return { consultation_id: response.data.consultation_id, status: response.data.status || "queued" };
}

export async function getConsultationStatus(consultationId: number): Promise<ConsultationStatus> {
  const response = await apiClient.get<ConsultationStatus>(`/consultation/${consultationId}/status`);
  return response.data;
}

export async function approveSoap(consultationId: number, approvedSoap: string, doctorId: number | null): Promise<void> {
  await apiClient.post(`/consultation/${consultationId}/approve`, {
    approved_soap: approvedSoap,
    doctor_id: doctorId,
  });
}
