import { NextResponse } from "next/server";
import { fetchSemseData, handleServerError, isApiBaseConfigured } from "../../_server";
import type { RuntimeServiceStatus } from "@semse/schemas";

export async function GET() {
  if (!isApiBaseConfigured()) {
    return NextResponse.json({ error: { status: 503, message: "SEMSE server runtime is not configured" } }, { status: 503 });
  }

  try {
    const data = await fetchSemseData<RuntimeServiceStatus[]>("/v1/runtime-knowledge/status");
    return NextResponse.json({ data });
  } catch (error) {
    return handleServerError(error);
  }
}

