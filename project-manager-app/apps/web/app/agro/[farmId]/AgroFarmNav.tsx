"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { useFarmTabs } from "./use-farm-viewer";

/** Migas + pestañas de finca para las pantallas de Workforce e IncidentOps. */
export function AgroFarmNav({ farmId, crumbs }: { farmId: string; crumbs: Array<{ label: string; href?: string }> }) {
  const pathname = usePathname();
  const tabs = useFarmTabs(farmId);
  return (
    <>
      <nav className="bread" aria-label="Migas de pan">
        <Link href="/agro">Agro</Link>
        <ChevronRight size={12} color="var(--faint)" aria-hidden />
        <Link href={`/agro/${farmId}`}>Finca</Link>
        {crumbs.map((c) => (
          <span key={c.label} style={{ display: "contents" }}>
            <ChevronRight size={12} color="var(--faint)" aria-hidden />
            {c.href ? <Link href={c.href}>{c.label}</Link> : <span style={{ color: "var(--ink)" }}>{c.label}</span>}
          </span>
        ))}
      </nav>
      <nav className="tab-bar" aria-label="Secciones de la finca">
        {tabs.map((tab) => (
          <Link key={tab.href} href={tab.href} className="tab-item"
            data-active={pathname === tab.href || (tab.href.endsWith("/incidents") && pathname.startsWith(tab.href)) || (tab.href.endsWith("/workforce") && pathname.startsWith(tab.href)) ? "true" : "false"}>
            {tab.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
