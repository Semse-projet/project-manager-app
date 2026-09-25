import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, isSemseRuntimeEnabled, runtimeDisabledResponse } from "../_server";

/**
 * Proxy BFF de Agro Workforce / IncidentOps. Mantiene el patrón del resto de
 * rutas Agro (identidad resuelta en servidor, nunca desde el cliente) sin
 * repetir el mismo try/catch en cada archivo. `apiPath` siempre lo construye la
 * ruta a partir de segmentos codificados y acciones en allowlist.
 */
export async function proxyAgro(req: NextRequest, apiPath: string, method: "GET" | "POST" | "PATCH") {
  if (!isSemseRuntimeEnabled()) return runtimeDisabledResponse();
  let body: string | undefined;
  if (method !== "GET") {
    try {
      body = JSON.stringify(await req.json());
    } catch {
      return NextResponse.json({ error: { status: 400, message: "Invalid JSON body" } }, { status: 400 });
    }
  }
  try {
    const qs = method === "GET" ? new URL(req.url).search : "";
    const data = await fetchSemseDataForRequest<unknown>(`${apiPath}${qs}`, req, {
      method,
      ...(body !== undefined && { headers: { "content-type": "application/json" }, body }),
    });
    return NextResponse.json({ data }, { status: method === "POST" ? 201 : 200 });
  } catch (error) {
    return handleServerError(error);
  }
}

export const enc = encodeURIComponent;

export function notFound() {
  return NextResponse.json({ error: { status: 404, message: "Unknown action" } }, { status: 404 });
}
