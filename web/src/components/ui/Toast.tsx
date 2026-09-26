import { cn } from "../../lib/cn";
import { Button } from "./Button";
import { useToast, type ToastTone } from "./useToast";

const tones: Record<ToastTone, string> = {
  info: "border-info/30",
  success: "border-success/30",
  warning: "border-warning/40",
  danger: "border-danger/30",
};

export function ToastPortal() {
  const { toasts, dismiss } = useToast();

  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className={cn("pointer-events-auto rounded-lg border bg-surface p-3 shadow-none", tones[toast.tone])}
        >
          <p className="break-words text-sm font-semibold text-ink">{toast.message}</p>
          <Button variant="ghost" className="mt-2 px-2" onClick={() => dismiss(toast.id)}>
            Dismiss
          </Button>
        </div>
      ))}
    </div>
  );
}
