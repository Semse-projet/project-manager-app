import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, resolveRuntimeConfigForRequest, runtimeDisabledResponse } from "../../../../_server";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const config = await resolveRuntimeConfigForRequest(req);
  if (!config) return runtimeDisabledResponse();

  let body: Record<string, unknown>;
  try { body = await req.json() as Record<string, unknown>; } catch {
    return NextResponse.json({ error: { status: 400, message: "Invalid JSON body" } }, { status: 400 });
  }
  try {
    const { id } = await params;
    // Override voterId with the real session user — never trust client-sent value
    const payload = { ...body, voterId: config.userId };
    const data = await fetchSemseDataForRequest(`/v1/governance/proposals/${encodeURIComponent(id)}/vote`, req, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return handleServerError(error);
  }
}
