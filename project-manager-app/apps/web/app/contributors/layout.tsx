import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ContributorsShell } from "./ContributorsShell";

export const metadata: Metadata = {
  title: "SEMSE Knowledge Contributor Program",
  description:
    "SEMSE paga por documentación útil de trabajos reales de construcción. Acepta misiones, documenta tu trabajo y recibe la compensación indicada.",
  robots: { index: true, follow: true },
};

export default function ContributorsLayout({ children }: { children: ReactNode }) {
  return <ContributorsShell>{children}</ContributorsShell>;
}
