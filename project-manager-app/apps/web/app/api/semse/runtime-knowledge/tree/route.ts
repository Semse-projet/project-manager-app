import { NextResponse } from "next/server";
import { fetchSemseData, handleServerError, isApiBaseConfigured } from "../../_server";
import type { RuntimeTreeNode } from "@semse/schemas";

export async function GET() {
  if (!isApiBaseConfigured()) {
    return NextResponse.json({ error: { status: 503, message: "SEMSE server runtime is not configured" } }, { status: 503 });
  }

  try {
    const data = await fetchSemseData<RuntimeTreeNode>("/v1/runtime-knowledge/tree");
    return NextResponse.json({ data });
  } catch (error) {
    return handleServerError(error);
  }
}

