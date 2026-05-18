import { NextRequest, NextResponse } from "next/server";
import { handleServerError, runtimeDisabledResponse } from "../../_server";

const API_BASE = process.env.SEMSE_API_BASE_URL ?? "http://localhost:4000";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const headers: Record<string, string> = { "content-type": "application/json" };

    // Forward auth headers from the incoming request
    const tenantId = request.headers.get("x-tenant-id");
    const auth     = request.headers.get("authorization");
    if (tenantId) headers["x-tenant-id"] = tenantId;
    if (auth)     headers["authorization"] = auth;

    const resp = await fetch(`${API_BASE}/v1/ops/ai-mission-control/backfill-embeddings`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const text = await resp.text();
      return NextResponse.json({ error: text.slice(0, 200) }, { status: resp.status });
    }

    const json = await resp.json();
    return NextResponse.json(json);
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) {
      return runtimeDisabledResponse();
    }
    return handleServerError(error);
  }
}
