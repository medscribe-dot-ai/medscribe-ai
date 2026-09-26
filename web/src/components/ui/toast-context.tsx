import { useMemo, useState, type ReactNode } from "react";
import { ToastContext, type ToastContextValue, type ToastItem } from "./useToast";

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const value = useMemo<ToastContextValue>(
    () => ({
      toasts,
      push(message, tone = "info") {
        const id = Date.now();
        setToasts((current) => [...current, { id, message, tone }]);
      },
      dismiss(id) {
        setToasts((current) => current.filter((toast) => toast.id !== id));
      },
    }),
    [toasts],
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}
