"use client";

import { useCallback, useEffect, useState } from "react";
import { useWorkspaceStore, workspaceStore } from "../../../lib/stores/workspaceStore";

export function getWorkspaceErrorStatus(error: unknown): number | null {
  if (typeof error === "object" && error !== null && "status" in error && typeof error.status === "number" && Number.isInteger(error.status)) return error.status;
  const message = error instanceof Error ? error.message : "";
  const match = message.match(/\b(401|403)\b/);
  return match ? Number(match[1]) : null;
}
function errorMessage(error: unknown, status: number | null): string {
  if (status === 401) return "La sesión no está disponible. Vuelve a iniciar sesión. (401)";
  if (status === 403) return "No tienes acceso a este recurso. La API mantiene su autorización. (403)";
  return error instanceof Error ? error.message : "No se pudo completar la consulta.";
}

export function useWorkspaceQuery<T>(key: string | null, loader: () => Promise<T>) {
  const { scopeVersion, sessionUnavailable, error: scopeError } = useWorkspaceStore();
  const [revision, setRevision] = useState(0);
  const [snapshot, setSnapshot] = useState<{ key: string; scopeVersion: number; data: T | null; error: string | null; status: number | null; loading: boolean } | null>(null);
  useEffect(() => {
    if (!key) { setSnapshot(null); return; }
    if (sessionUnavailable) {
      setSnapshot({ key, scopeVersion, data: null, error: workspaceStore.getSnapshot().error ?? "La sesión no está disponible. (401)", status: 401, loading: false });
      return;
    }
    let current = true;
    const isCurrent = () => current && workspaceStore.getSnapshot().scopeVersion === scopeVersion && !workspaceStore.getSnapshot().sessionUnavailable;
    setSnapshot({ key, scopeVersion, data: null, error: null, status: null, loading: true });
    Promise.resolve().then(loader).then(
      (data) => { if (isCurrent()) setSnapshot({ key, scopeVersion, data, error: null, status: null, loading: false }); },
      (error: unknown) => {
        if (!isCurrent()) return;
        const status = getWorkspaceErrorStatus(error);
        const message = errorMessage(error, status);
        if (status === 401) { workspaceStore.invalidateSession(message); return; }
        setSnapshot({ key, scopeVersion, data: null, error: message, status, loading: false });
      },
    );
    return () => { current = false; };
  }, [key, loader, revision, scopeVersion, sessionUnavailable]);
  const retry = useCallback(() => {
    if (workspaceStore.getSnapshot().sessionUnavailable) {
      void workspaceStore.refresh();
    } else setRevision((value) => value + 1);
  }, []);
  const active = key && snapshot?.key === key && snapshot.scopeVersion === scopeVersion ? snapshot : null;
  if (key && sessionUnavailable) return { data: null, error: scopeError ?? "La sesión no está disponible. (401)", status: 401, loading: false, retry };
  return { data: active?.data ?? null, error: active?.error ?? null, status: active?.status ?? null, loading: Boolean(key) && (!active || active.loading), retry };
}

export function isWorkspaceAccessError(message: string | null, status?: number | null): boolean {
  if (status === 401 || status === 403) return true;
  return Boolean(message && /\b(401|403)\b|forbidden|unauthori[sz]ed|sin permiso|no autorizado|acceso denegado|insufficient permissions|authenticated semse session required/i.test(message));
}
