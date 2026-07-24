import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForAuthenticatedRequest, handleServerError, isApiBaseConfigured } from "../../../_server";
import type { RuntimeNode } from "@semse/schemas";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isApiBaseConfigured()) {
    return NextResponse.json({ error: { status: 503, message: "SEMSE server runtime is not configured" } }, { status: 503 });
  }

  try {
    const { id } = await params;
    const data = await fetchSemseDataForAuthenticatedRequest<RuntimeNode>(`/v1/runtime-knowledge/node/${id}`, request);
    return NextResponse.json({ data });
  } catch (error) {
    return handleServerError(error);
  }
}
