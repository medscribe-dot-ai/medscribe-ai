export class AppError extends Error {
  code: string;
  status?: number;
  payload?: unknown;

  constructor(message: string, options: { code: string; status?: number; payload?: unknown }) {
    super(message);
    this.name = "AppError";
    this.code = options.code;
    this.status = options.status;
    this.payload = options.payload;
  }
}

function looksTechnical(text: string) {
  return /traceback|sqlalchemy|psycopg|exception|stack trace|programmingerror/i.test(text);
}

function fallbackMessage(status?: number) {
  if (status === 401 || status === 403) {
    return "Invalid email or password.";
  }
  if (status === 409) {
    return "That action conflicts with an existing record.";
  }
  if (status === 422) {
    return "Please check the form and try again.";
  }
  return "Something went wrong. Please try again.";
}

function messageFromDetail(detail: unknown, status?: number): string {
  if (typeof detail === "string") {
    const text = detail.trim();
    if (!text || looksTechnical(text)) {
      return fallbackMessage(status);
    }
    return text;
  }

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (!item || typeof item !== "object" || !("msg" in item)) {
          return "";
        }
        const msg = item.msg;
        return typeof msg === "string" ? msg.trim() : "";
      })
      .filter((msg) => msg && !looksTechnical(msg));
    if (messages.length > 0) {
      return messages.join(" ");
    }
    return fallbackMessage(status ?? 422);
  }

  if (detail && typeof detail === "object") {
    const record = detail as Record<string, unknown>;
    if (typeof record.message === "string" && record.message.trim() && !looksTechnical(record.message)) {
      return record.message.trim();
    }
    return fallbackMessage(status);
  }

  return fallbackMessage(status);
}

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  const axiosError = error as {
    response?: { status?: number; data?: { detail?: unknown; message?: unknown } };
    message?: string;
    isAxiosError?: boolean;
  };

  if (!axiosError?.response) {
    return new AppError("Unable to reach the server. Check your connection and try again.", {
      code: "network",
    });
  }

  const status = axiosError.response.status;
  const data = axiosError.response.data;
  const detail = data?.detail ?? data?.message;
  return new AppError(messageFromDetail(detail, status), {
    code: status === 422 ? "validation" : status === 409 ? "conflict" : "http",
    status,
    payload: data,
  });
}
