import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForAuthenticatedRequest, handleServerError, isApiBaseConfigured } from "../../_server";
import type { RuntimeServiceStatus } from "@semse/schemas";

export async function GET(request: NextRequest) {
  if (!isApiBaseConfigured()) {
    return NextResponse.json({ error: { status: 503, message: "SEMSE server runtime is not configured" } }, { status: 503 });
  }

  try {
    const data = await fetchSemseDataForAuthenticatedRequest<RuntimeServiceStatus[]>("/v1/runtime-knowledge/status", request);
    return NextResponse.json({ data });
  } catch (error) {
    return handleServerError(error);
  }
}
