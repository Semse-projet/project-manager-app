import {
  missionLoadResponseSchema,
  missionUnloadResponseSchema,
  navigationUpdateResponseSchema,
  workspaceContextResponseSchema,
  type MissionLoadResponse,
  type MissionUnloadResponse,
  type NavigationUpdateResponse,
  type UpdateNavigationRequest,
  type WorkspaceContextResponse,
  type WorkspaceMissionType,
} from "@semse/schemas";

type ResponseValidator<T> = {
  safeParse(value: unknown): { success: true; data: T } | { success: false; error: unknown };
};

async function request<T>(path: string, validator: ResponseValidator<T>, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(path, { ...init, signal: controller.signal, cache: "no-store" });
    if (!response.ok) {
      const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
      const fallback = response.status === 401
        ? "La sesión no está disponible. Vuelve a iniciar sesión."
        : response.status === 403
          ? "No tienes acceso a esta operación."
          : "No se pudo completar la solicitud.";
      throw new Error(`${body?.error?.message ?? fallback} (${response.status})`);
    }
    const json = await response.json() as { data: unknown };
    if (!json || typeof json !== "object" || !("data" in json)) {
      throw new Error("La respuesta no cumple el contrato del workspace. Actualiza para consultar su estado actual.");
    }
    const parsed = validator.safeParse(json.data);
    if (!parsed.success) throw new Error("La respuesta no cumple el contrato del workspace. No se confirmó ningún cambio en la pantalla.");
    return parsed.data;
  } catch (error) {
    if (controller.signal.aborted) throw new Error("El workspace tardó demasiado en responder. Reintenta para consultar su estado actual.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function getWorkspaceContext(): Promise<WorkspaceContextResponse> {
  return request("/api/semse/workspace/context", workspaceContextResponseSchema);
}
export function updateWorkspaceNavigation(input: UpdateNavigationRequest): Promise<NavigationUpdateResponse> {
  return request("/api/semse/workspace/navigation", navigationUpdateResponseSchema, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input),
  });
}
export function loadWorkspaceMission(input: { missionId: string; missionType: WorkspaceMissionType; title?: string }): Promise<MissionLoadResponse> {
  return request("/api/semse/workspace/mission/load", missionLoadResponseSchema, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input),
  });
}
export function unloadWorkspaceMission(missionId: string): Promise<MissionUnloadResponse> {
  return request("/api/semse/workspace/mission/unload", missionUnloadResponseSchema, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ missionId }),
  });
}
