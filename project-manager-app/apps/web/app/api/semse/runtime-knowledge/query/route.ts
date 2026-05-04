import { NextRequest, NextResponse } from "next/server";
import { runtimeQuerySchema, type RuntimeQuery } from "@semse/schemas";
import { fetchSemseData, handleServerError, isApiBaseConfigured } from "../../_server";

export async function POST(request: NextRequest) {
  if (!isApiBaseConfigured()) {
    return NextResponse.json({ error: { status: 503, message: "SEMSE server runtime is not configured" } }, { status: 503 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const parsed = runtimeQuerySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: { status: 400, message: "Invalid runtime knowledge query payload" } }, { status: 400 });
    }

    const data = await fetchSemseData<RuntimeQuery & Record<string, unknown>>("/v1/runtime-knowledge/query", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(parsed.data)
    });
    return NextResponse.json({ data });
  } catch (error) {
    return handleServerError(error);
  }
}

