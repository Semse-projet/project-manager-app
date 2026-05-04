import { NextResponse } from "next/server";
import { fetchSemseData, handleServerError, isApiBaseConfigured } from "../../_server";
import type { KnowledgeDomainSummary } from "@semse/schemas";

export async function GET() {
  if (!isApiBaseConfigured()) {
    return NextResponse.json({ error: { status: 503, message: "SEMSE server runtime is not configured" } }, { status: 503 });
  }

  try {
    const data = await fetchSemseData<KnowledgeDomainSummary[]>("/v1/knowledge/domains");
    return NextResponse.json({ data });
  } catch (error) {
    return handleServerError(error);
  }
}

