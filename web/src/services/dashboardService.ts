import { apiClient } from "../api/client";
import type { ReceptionistStats } from "../types/admin";

export async function getReceptionistStats(): Promise<ReceptionistStats> {
  const response = await apiClient.get<ReceptionistStats>("/dashboard/receptionist-stats");
  return response.data;
}
