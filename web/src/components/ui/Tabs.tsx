import { useState, type ReactNode } from "react";
import { cn } from "../../lib/cn";
import { focusClass } from "./fieldStyles";

export type TabItem = {
  id: string;
  label: string;
  content: ReactNode;
};

export function Tabs({ tabs, label }: { tabs: TabItem[]; label: string }) {
  const [active, setActive] = useState(tabs[0]?.id ?? "");
  const current = tabs.find((tab) => tab.id === active) ?? tabs[0];

  return (
    <div>
      <div role="tablist" aria-label={label} className="flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const selected = tab.id === current?.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              className={cn(
                "min-h-10 rounded-md border px-4 text-base font-semibold",
                focusClass,
                selected ? "border-primary-hover bg-mint text-primary-hover" : "border-line bg-surface text-ink",
              )}
              onClick={() => setActive(tab.id)}
              onKeyDown={(event) => {
                if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") {
                  return;
                }
                event.preventDefault();
                const index = tabs.findIndex((item) => item.id === tab.id);
                const nextIndex =
                  event.key === "ArrowRight"
                    ? (index + 1) % tabs.length
                    : (index - 1 + tabs.length) % tabs.length;
                const nextId = tabs[nextIndex].id;
                setActive(nextId);
                document.getElementById(`tab-${nextId}`)?.focus();
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {current ? (
        <div role="tabpanel" id={`panel-${current.id}`} aria-labelledby={`tab-${current.id}`} className="pt-4">
          {current.content}
        </div>
      ) : null}
    </div>
  );
}
