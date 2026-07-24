import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForAuthenticatedRequest, handleServerError, isApiBaseConfigured } from "../../_server";
import type { KnowledgeOverview } from "@semse/schemas";

export async function GET(request: NextRequest) {
  if (!isApiBaseConfigured()) {
    return NextResponse.json({ error: { status: 503, message: "SEMSE server runtime is not configured" } }, { status: 503 });
  }

  try {
    const data = await fetchSemseDataForAuthenticatedRequest<KnowledgeOverview>("/v1/knowledge/overview", request);
    return NextResponse.json({ data });
  } catch (error) {
    return handleServerError(error);
  }
}
