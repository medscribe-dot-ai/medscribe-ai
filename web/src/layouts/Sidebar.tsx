import { NavLink } from "react-router-dom";
import { BrandLockup } from "../components/BrandLogo";
import { cn } from "../lib/cn";
import { focusClass } from "../components/ui/fieldStyles";
import type { NavItem } from "./navigation";

type SidebarNavProps = {
  items: NavItem[];
  activeId: string;
  collapsed?: boolean;
  onSelect: (id: string) => void;
};

export function SidebarNav({ items, activeId, collapsed = false, onSelect }: SidebarNavProps) {
  return (
    <ul className="flex flex-col gap-1">
      {items.map((item) => {
        const active = item.id === activeId;
        return (
          <li key={item.id}>
            {item.href ? (
              <NavLink
                to={item.href}
                end={item.href === "/admin" || item.href === "/reception" || item.href === "/doctor"}
                aria-label={item.label}
                className={({ isActive }) =>
                  cn(
                    "flex min-h-10 w-full items-center rounded-md px-3 text-left text-base font-semibold",
                    focusClass,
                    collapsed && "justify-center px-0",
                    isActive ? "bg-mint text-primary-hover" : "text-ink hover:bg-accent",
                  )
                }
                onClick={() => onSelect(item.id)}
              >
                {collapsed ? item.label.slice(0, 1) : item.label}
              </NavLink>
            ) : (
              <button
                type="button"
                aria-current={active ? "page" : undefined}
                aria-label={item.label}
                className={cn(
                  "flex min-h-10 w-full items-center rounded-md px-3 text-left text-base font-semibold",
                  focusClass,
                  collapsed && "justify-center px-0",
                  active ? "bg-mint text-primary-hover" : "text-ink hover:bg-accent",
                )}
                onClick={() => onSelect(item.id)}
              >
                {collapsed ? item.label.slice(0, 1) : item.label}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

type SidebarProps = {
  items: NavItem[];
  activeId: string;
  collapsed: boolean;
  onSelect: (id: string) => void;
  onToggleCollapsed: () => void;
  label: string;
};

export function Sidebar({ items, activeId, collapsed, onSelect, onToggleCollapsed, label }: SidebarProps) {
  return (
    <aside
      className={cn(
        "hidden h-svh shrink-0 flex-col border-r border-line bg-surface lg:flex",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <div className={cn("flex items-center border-b border-line px-3 py-3", collapsed && "justify-center px-2 py-3")}>
        <BrandLockup collapsed={collapsed} />
      </div>
      <nav aria-label={label} className="flex-1 overflow-y-auto p-2">
        <SidebarNav items={items} activeId={activeId} collapsed={collapsed} onSelect={onSelect} />
      </nav>
      <div className="border-t border-line p-2">
        <button
          type="button"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn("min-h-10 w-full truncate rounded-md border border-line px-2 text-sm font-semibold text-ink", focusClass)}
          onClick={onToggleCollapsed}
        >
          {collapsed ? "»" : "Collapse"}
        </button>
      </div>
    </aside>
  );
}
