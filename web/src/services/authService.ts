import type { UserSession } from "../auth/session";
import { env } from "../config/env";
import { apiClient } from "../api/client";
import { AppError } from "../api/errors";

function toSession(user: unknown): UserSession {
  if (!user || typeof user !== "object") {
    throw new AppError("Sign-in response was incomplete.", { code: "invalid_response" });
  }
  const record = user as Record<string, unknown>;
  if (
    typeof record.user_id !== "number" ||
    typeof record.name !== "string" ||
    typeof record.email !== "string" ||
    typeof record.role !== "string"
  ) {
    throw new AppError("Sign-in response was incomplete.", { code: "invalid_response" });
  }

  return {
    user_id: record.user_id,
    name: record.name,
    email: record.email,
    role: record.role.toLowerCase(),
    ...(typeof record.doctor_id === "number" ? { doctor_id: record.doctor_id } : {}),
    ...(typeof record.receptionist_id === "number" ? { receptionist_id: record.receptionist_id } : {}),
  };
}

export async function login(email: string, password: string): Promise<UserSession> {
  if (!env.apiUrl) {
    throw new AppError("The clinic API address is not configured.", { code: "config" });
  }

  const response = await apiClient.post("/login", { email, password });
  const body = response.data as { status?: unknown; user?: unknown; message?: unknown; detail?: unknown };

  if (body?.status !== "success" || !body.user) {
    const raw = body?.message ?? body?.detail;
    const message = typeof raw === "string" && raw.trim() ? raw.trim() : "Invalid email or password.";
    throw new AppError(message, { code: "login_failed" });
  }

  return toSession(body.user);
}
