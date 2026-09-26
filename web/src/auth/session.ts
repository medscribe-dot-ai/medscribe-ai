export type UserSession = {
  user_id: number;
  name: string;
  email: string;
  role: string;
  doctor_id?: number;
  receptionist_id?: number;
};

const SESSION_KEY = "medscribeai.session";

function isSession(value: unknown): value is UserSession {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.user_id === "number" &&
    typeof record.name === "string" &&
    typeof record.email === "string" &&
    typeof record.role === "string"
  );
}

export function readSession(): UserSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!isSession(parsed)) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return {
      user_id: parsed.user_id,
      name: parsed.name,
      email: parsed.email,
      role: parsed.role.toLowerCase(),
      ...(typeof parsed.doctor_id === "number" ? { doctor_id: parsed.doctor_id } : {}),
      ...(typeof parsed.receptionist_id === "number" ? { receptionist_id: parsed.receptionist_id } : {}),
    };
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function writeSession(session: UserSession) {
  const stored: UserSession = {
    user_id: session.user_id,
    name: session.name,
    email: session.email,
    role: session.role.toLowerCase(),
    ...(typeof session.doctor_id === "number" ? { doctor_id: session.doctor_id } : {}),
    ...(typeof session.receptionist_id === "number" ? { receptionist_id: session.receptionist_id } : {}),
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(stored));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}
