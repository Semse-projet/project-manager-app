"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sprout, AlertTriangle, Loader2 } from "lucide-react";

type DemoState = "starting" | "error" | "rate-limited";

export default function DemoAgroPage() {
  const router = useRouter();
  const [state, setState] = useState<DemoState>("starting");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/semse/demo/session", { method: "POST" });
        const json = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          redirectTo?: string;
          error?: string;
        };
        if (cancelled) return;
        if (res.ok && json.ok) {
          router.replace(json.redirectTo ?? "/agro");
          return;
        }
        setMessage(json.error ?? null);
        setState(res.status === 429 ? "rate-limited" : "error");
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--ink)] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-3xl p-10">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500 to-lime-600 text-white flex items-center justify-center">
          <Sprout size={28} />
        </div>

        {state === "starting" && (
          <>
            <h1 className="text-xl font-black text-slate-900 dark:text-white">
              Preparando tu demo de SEMSE Agro…
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Estamos cargando una finca de demostración con animales, inventario
              y tareas. No necesitas cuenta.
            </p>
            <Loader2 className="mx-auto animate-spin text-green-600" size={24} />
          </>
        )}

        {state === "rate-limited" && (
          <>
            <h1 className="text-xl font-black text-slate-900 dark:text-white">
              Demasiados intentos
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {message ?? "Espera un minuto e intenta de nuevo."}
            </p>
          </>
        )}

        {state === "error" && (
          <>
            <div className="mx-auto w-10 h-10 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <AlertTriangle size={20} />
            </div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white">
              La demo no está disponible ahora
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {message ?? "Intenta más tarde, o crea una cuenta para usar SEMSE Agro completo."}
            </p>
          </>
        )}

        <div className="flex flex-col gap-2 pt-2">
          <Link
            href="/register?from=agro"
            className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold text-sm no-underline transition-colors"
          >
            Crear cuenta gratis
          </Link>
          <Link
            href="/hub"
            className="text-xs font-bold text-slate-500 dark:text-slate-400 no-underline hover:underline"
          >
            ← Volver al Hub
          </Link>
        </div>
      </div>
    </main>
  );
}
