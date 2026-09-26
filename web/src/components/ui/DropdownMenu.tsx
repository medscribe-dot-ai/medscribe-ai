import { useEffect, useId, useRef, useState } from "react";
import { cn } from "../../lib/cn";
import { Button } from "./Button";
import { focusClass } from "./fieldStyles";

export type MenuItem = {
  id: string;
  label: string;
  onSelect: () => void;
};

export function DropdownMenu({ label, items }: { label: string; items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onPointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <Button variant="secondary" aria-expanded={open} aria-controls={menuId} aria-haspopup="menu" onClick={() => setOpen((value) => !value)}>
        {label}
      </Button>
      {open ? (
        <div id={menuId} role="menu" aria-label={label} className="absolute left-0 z-20 mt-2 max-h-72 w-[min(16rem,calc(100vw-2rem))] overflow-y-auto rounded-md border border-line bg-surface p-1">
          {items.map((item, index) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              className={cn("flex min-h-10 w-full items-center rounded-md px-3 text-left text-base font-semibold text-ink hover:bg-mint", focusClass)}
              onKeyDown={(event) => {
                const buttons = rootRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]');
                if (!buttons || buttons.length === 0) return;
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  buttons[(index + 1) % buttons.length]?.focus();
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  buttons[(index - 1 + buttons.length) % buttons.length]?.focus();
                } else if (event.key === "Home") {
                  event.preventDefault();
                  buttons[0]?.focus();
                } else if (event.key === "End") {
                  event.preventDefault();
                  buttons[buttons.length - 1]?.focus();
                }
              }}
              onClick={() => {
                item.onSelect();
                setOpen(false);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
