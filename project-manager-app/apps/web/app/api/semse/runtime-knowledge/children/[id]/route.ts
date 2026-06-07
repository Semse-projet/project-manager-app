import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, isApiBaseConfigured } from "../../../_server";
import type { RuntimeNode } from "@semse/schemas";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isApiBaseConfigured()) {
    return NextResponse.json({ error: { status: 503, message: "SEMSE server runtime is not configured" } }, { status: 503 });
  }

  try {
    const { id } = await params;
    const data = await fetchSemseDataForRequest<RuntimeNode[]>(`/v1/runtime-knowledge/children/${id}`, request);
    return NextResponse.json({ data });
  } catch (error) {
    return handleServerError(error);
  }
}

