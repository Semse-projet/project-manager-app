"use client";

import { useCallback } from "react";
import { usePathname } from "next/navigation";
import type { CopilotContextResponse } from "@semse/schemas";
import { detectCopilotContext } from "../bff/prometeo";
import { useWorkspaceQuery } from "../../app/workspace/lib/use-workspace-query";

export type UseCopilotContext = {
  context: CopilotContextResponse | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
};

/** The existing context endpoint stays authoritative; a 401 retires its scope. */
export function useCopilotContext(): UseCopilotContext {
  const pathname = usePathname();
  const load = useCallback(() => detectCopilotContext({
    currentUrl: typeof window !== "undefined" ? window.location.href : pathname,
  }), [pathname]);
  const query = useWorkspaceQuery<CopilotContextResponse>(`copilot-context:${pathname}`, load);
  return { context: query.data, loading: query.loading, error: query.error, refresh: query.retry };
}
