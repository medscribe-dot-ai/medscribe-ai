import { apiClient } from "../api/client";
import type { ReceptionistDetail, ReceptionistSummary, ReceptionistWrite } from "../types/admin";

export async function listReceptionists(): Promise<ReceptionistSummary[]> {
  const response = await apiClient.get<ReceptionistSummary[]>("/receptionists");
  return Array.isArray(response.data) ? response.data : [];
}

export async function getReceptionist(receptionistId: number): Promise<ReceptionistDetail> {
  const response = await apiClient.get<ReceptionistDetail>(`/receptionists/${receptionistId}`);
  return response.data;
}

export async function createReceptionist(input: ReceptionistWrite): Promise<number> {
  const response = await apiClient.post<{ receptionist_id?: number }>("/admin/add-receptionist", {
    user_data: {
      name: input.name.trim(),
      email: input.email.trim(),
      username: input.username.trim(),
      password: input.password,
      phone: input.phone.trim(),
    },
  });
  if (typeof response.data.receptionist_id !== "number") {
    throw new Error("Receptionist was saved, but the response did not include an id.");
  }
  return response.data.receptionist_id;
}

export async function updateReceptionist(receptionistId: number, input: ReceptionistWrite): Promise<void> {
  await apiClient.put(`/receptionists/${receptionistId}`, {
    name: input.name.trim(),
    email: input.email.trim(),
    username: input.username.trim(),
    phone: input.phone.trim(),
    ...(input.password ? { password: input.password } : {}),
  });
}

export async function deleteReceptionist(receptionistId: number): Promise<void> {
  await apiClient.delete(`/receptionists/${receptionistId}`);
}
