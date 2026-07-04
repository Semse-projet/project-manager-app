import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, isApiBaseConfigured, runtimeDisabledResponse } from "../../_server";

export const dynamic = "force-dynamic";

/** SPEC-AUT-001 — estado y métricas de los permanent loops (panel OMEGA). */
export async function GET(request: NextRequest) {
  if (!isApiBaseConfigured()) {
    return runtimeDisabledResponse();
  }

  try {
    const data = await fetchSemseDataForRequest("/v1/ops/loops", request);
    return NextResponse.json({ data });
  } catch (error) {
    return handleServerError(error);
  }
}
