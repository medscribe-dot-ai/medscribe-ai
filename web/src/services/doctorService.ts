import { apiClient } from "../api/client";
import type { DoctorDetail, DoctorSummary, DoctorWrite } from "../types/admin";

function formatDoctorName(name: string) {
  const cleaned = name.trim().replace(/^dr\.?\s+/i, "").trim();
  return cleaned ? `Dr. ${cleaned}` : "";
}

export async function listDoctors(): Promise<DoctorSummary[]> {
  const response = await apiClient.get<DoctorSummary[]>("/doctors");
  return Array.isArray(response.data) ? response.data : [];
}

export async function getDoctor(doctorId: number): Promise<DoctorDetail> {
  const response = await apiClient.get<DoctorDetail>(`/doctors/${doctorId}`);
  return {
    ...response.data,
    schedule: response.data.schedule && typeof response.data.schedule === "object" ? response.data.schedule : {},
  };
}

export async function createDoctor(input: DoctorWrite): Promise<number> {
  const response = await apiClient.post<{ doctor_id?: number }>("/admin/add-doctor", {
    user_data: {
      name: formatDoctorName(input.name),
      email: input.email.trim(),
      username: input.username.trim(),
      password: input.password,
      phone: input.phone.trim(),
    },
    specialization: input.specialization,
    experience_years: input.experience_years,
    availability_status: "available",
    schedule: input.schedule,
  });
  if (typeof response.data.doctor_id !== "number") {
    throw new Error("Doctor was saved, but the response did not include an id.");
  }
  return response.data.doctor_id;
}

export async function updateDoctor(doctorId: number, input: DoctorWrite): Promise<void> {
  await apiClient.put(`/doctors/${doctorId}`, {
    name: formatDoctorName(input.name),
    email: input.email.trim(),
    username: input.username.trim(),
    phone: input.phone.trim(),
    ...(input.password ? { password: input.password } : {}),
    specialization: input.specialization,
    experience_years: input.experience_years,
    schedule: input.schedule,
  });
}

export async function deleteDoctor(doctorId: number): Promise<void> {
  await apiClient.delete(`/doctors/${doctorId}`);
}
