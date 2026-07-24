import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForAuthenticatedRequest, handleServerError, isApiBaseConfigured } from "../../_server";
import type { KnowledgeDomainSummary } from "@semse/schemas";

export async function GET(request: NextRequest) {
  if (!isApiBaseConfigured()) {
    return NextResponse.json({ error: { status: 503, message: "SEMSE server runtime is not configured" } }, { status: 503 });
  }

  try {
    const data = await fetchSemseDataForAuthenticatedRequest<KnowledgeDomainSummary[]>("/v1/knowledge/domains", request);
    return NextResponse.json({ data });
  } catch (error) {
    return handleServerError(error);
  }
}
