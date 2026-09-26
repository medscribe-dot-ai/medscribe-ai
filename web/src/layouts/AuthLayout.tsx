import type { ReactNode } from "react";
import { ToastPortal } from "../components/ui/Toast";

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4 py-10">
      <a
        href="#main-content"
        className="absolute left-4 top-4 z-50 -translate-y-24 rounded-md bg-surface px-3 py-2 text-sm font-semibold text-ink focus:translate-y-0"
      >
        Skip to content
      </a>
      <div id="main-content" tabIndex={-1} className="w-full max-w-3xl">
        {children}
      </div>
      <ToastPortal />
    </div>
  );
}
