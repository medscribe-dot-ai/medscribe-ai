import { apiClient } from "../api/client";
import type { AppointmentCreateInput, AppointmentRow } from "../types/admin";

export async function listAppointmentsByDate(date: string, doctorId?: number): Promise<AppointmentRow[]> {
  const response = await apiClient.get<AppointmentRow[]>("/appointments", {
    params: { date, ...(doctorId != null ? { doctor_id: doctorId } : {}) },
  });
  return Array.isArray(response.data) ? response.data : [];
}

export async function createAppointment(input: AppointmentCreateInput): Promise<AppointmentRow> {
  const response = await apiClient.post<AppointmentRow>("/appointments", input);
  return response.data;
}

export async function updateAppointmentStatus(appointmentId: number, status: string): Promise<AppointmentRow> {
  const response = await apiClient.patch<AppointmentRow>(`/appointments/${appointmentId}/status`, { status });
  return response.data;
}
