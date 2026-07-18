"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { CopilotContextResponse } from "@semse/schemas";
import { detectCopilotContext } from "../bff/prometeo";

export type UseCopilotContext = {
  context: CopilotContextResponse | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
};

/**
 * Detects the Prometeo Copilot's context from the current route. Re-runs
 * whenever the pathname changes so the floating Copilot always reflects the
 * module the user is looking at.
 */
export function useCopilotContext(): UseCopilotContext {
  const pathname = usePathname();
  const [context, setContext] = useState<CopilotContextResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (typeof window === "undefined") return;
    const currentUrl = window.location.href;
    setLoading(true);
    setError(null);
    detectCopilotContext({ currentUrl })
      .then(setContext)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "No se pudo detectar el contexto"),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [pathname, refresh]);

  return { context, loading, error, refresh };
}
