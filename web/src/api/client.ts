import axios from "axios";
import { readSession } from "../auth/session";
import { env } from "../config/env";
import { toAppError } from "./errors";

export const apiClient = axios.create({
  baseURL: env.apiUrl || undefined,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use((config) => {
  const session = readSession();
  if (session) {
    config.headers.set("X-User-Id", String(session.user_id));
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => Promise.reject(toAppError(error)),
);
