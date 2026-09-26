import { createContext, useContext } from "react";

export type ToastTone = "info" | "success" | "warning" | "danger";

export type ToastItem = {
  id: number;
  message: string;
  tone: ToastTone;
};

export type ToastContextValue = {
  toasts: ToastItem[];
  push: (message: string, tone?: ToastTone) => void;
  dismiss: (id: number) => void;
};

export const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}
