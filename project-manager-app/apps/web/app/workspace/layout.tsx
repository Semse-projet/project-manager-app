import type { ReactNode } from "react";

export default function WorkspaceRootLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-[var(--bg)]">{children}</div>;
}
