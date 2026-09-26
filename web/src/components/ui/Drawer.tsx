import { useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useOverlay } from "../../lib/useOverlay";
import { Button } from "./Button";

type DrawerProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

export function Drawer({ open, title, onClose, children }: DrawerProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  useOverlay(open, onClose, panelRef);

  if (!open) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-40 flex bg-ink/40">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="flex h-full w-72 max-w-[85vw] flex-col border-r border-line bg-surface p-4 outline-none"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id={titleId} className="text-lg font-semibold text-ink">
            {title}
          </h2>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
      <button type="button" aria-label="Close drawer" className="min-h-10 flex-1" onClick={onClose} />
    </div>,
    document.body,
  );
}
