import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, isSemseRuntimeEnabled, runtimeDisabledResponse } from "../../_server";

export const dynamic = "force-dynamic";

// Proxy directo a POST /v1/agro/sync/events (AgroDashboardController.syncEvents).
// El body ya viene con la forma { events: [...] } que espera syncBatchSchema
// server-side (min 1, max 100 eventos); no se revalida aqui para no duplicar
// la validacion, solo se reenvia.
export async function POST(req: NextRequest) {
  if (!isSemseRuntimeEnabled()) return runtimeDisabledResponse();
  try {
    const body = await req.json();
    const data = await fetchSemseDataForRequest<unknown>("/v1/agro/sync/events", req, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return NextResponse.json({ data });
  } catch (err) {
    return handleServerError(err);
  }
}
