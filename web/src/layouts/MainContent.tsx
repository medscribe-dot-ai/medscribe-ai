import type { ReactNode } from "react";

export function MainContent({ children }: { children: ReactNode }) {
  return (
    <main id="main-content" tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
      {children}
    </main>
  );
}
