import { useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useOverlay } from "../../lib/useOverlay";
import { Button } from "./Button";

type DialogProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

export function Dialog({ open, title, onClose, children }: DialogProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  useOverlay(open, onClose, panelRef);

  if (!open) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40 p-4 sm:items-center">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="flex max-h-[min(90svh,40rem)] w-full max-w-lg flex-col overflow-y-auto rounded-lg border border-line bg-surface p-4 outline-none"
      >
        <h2 id={titleId} className="text-xl font-semibold text-ink">
          {title}
        </h2>
        <div className="mt-3 text-base text-ink">{children}</div>
        <div className="mt-4">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
