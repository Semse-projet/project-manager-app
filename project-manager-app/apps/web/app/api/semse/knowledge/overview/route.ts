import { NextResponse } from "next/server";
import { fetchSemseData, handleServerError, isApiBaseConfigured } from "../../_server";
import type { KnowledgeOverview } from "@semse/schemas";

export async function GET() {
  if (!isApiBaseConfigured()) {
    return NextResponse.json({ error: { status: 503, message: "SEMSE server runtime is not configured" } }, { status: 503 });
  }

  try {
    const data = await fetchSemseData<KnowledgeOverview>("/v1/knowledge/overview");
    return NextResponse.json({ data });
  } catch (error) {
    return handleServerError(error);
  }
}

