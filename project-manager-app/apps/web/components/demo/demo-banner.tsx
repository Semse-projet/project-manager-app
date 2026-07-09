"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

function readDemoCookie(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)semse_demo=([^;]+)/);
  return match?.[1] ?? null;
}

// Banner persistente para vistas en modo demo (ui.demo-sandbox).
// Renderiza null fuera de una sesión demo — es seguro montarlo en layouts compartidos.
export function DemoBanner() {
  const [vertical, setVertical] = useState<string | null>(null);

  useEffect(() => {
    setVertical(readDemoCookie());
  }, []);

  if (!vertical) return null;

  return (
    <div
      data-testid="demo-banner"
      className="sticky top-0 z-50 bg-amber-500 text-amber-950 px-4 py-2.5 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-center"
    >
      <span className="text-xs font-black uppercase tracking-wider">
        Estás viendo datos de demostración
      </span>
      <span className="hidden sm:inline text-xs">
        Los cambios se restauran periódicamente.
      </span>
      <Link
        href={`/register?from=${vertical}`}
        className="text-xs font-black underline underline-offset-2 hover:no-underline"
      >
        Crear mi cuenta gratis →
      </Link>
    </div>
  );
}
