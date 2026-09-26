import { useState, type ReactNode } from "react";
import { Drawer } from "../components/ui/Drawer";
import { ToastPortal } from "../components/ui/Toast";
import { BrandLockup } from "../components/BrandLogo";
import type { NavItem } from "./navigation";
import { MainContent } from "./MainContent";
import { Sidebar, SidebarNav } from "./Sidebar";
import { TopBar } from "./TopBar";

type AppShellProps = {
  title: string;
  roleLabel: string;
  navLabel: string;
  items: NavItem[];
  children: ReactNode;
  onLogout?: () => void;
};

export function AppShell({ title, roleLabel, navLabel, items, children, onLogout }: AppShellProps) {
  const [activeId, setActiveId] = useState(items[0]?.id ?? "");
  const [collapsed, setCollapsed] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  function select(id: string) {
    setActiveId(id);
    setNavOpen(false);
  }

  return (
    <div className="flex min-h-svh bg-background">
      <a
        href="#main-content"
        className="absolute left-4 top-4 z-50 -translate-y-24 rounded-md bg-surface px-3 py-2 text-sm font-semibold text-ink focus:translate-y-0 focus-visible:translate-y-0"
      >
        Skip to content
      </a>
      <Sidebar
        items={items}
        activeId={activeId}
        collapsed={collapsed}
        label={navLabel}
        onSelect={select}
        onToggleCollapsed={() => setCollapsed((value) => !value)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar title={title} roleLabel={roleLabel} onOpenNav={() => setNavOpen(true)} onLogout={onLogout} />
        <MainContent>{children}</MainContent>
      </div>
      <Drawer open={navOpen} title="Navigation" onClose={() => setNavOpen(false)}>
        <div className="mb-3 border-b border-line pb-3">
          <BrandLockup />
        </div>
        <nav aria-label={navLabel}>
          <SidebarNav items={items} activeId={activeId} onSelect={select} />
        </nav>
      </Drawer>
      <ToastPortal />
    </div>
  );
}
