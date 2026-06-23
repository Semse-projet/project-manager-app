import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, isSemseRuntimeEnabled, runtimeDisabledResponse } from "../_server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isSemseRuntimeEnabled()) return runtimeDisabledResponse();
  try {
    const data = await fetchSemseDataForRequest("/v1/agro/farms", req);
    return NextResponse.json({ requestId: `agro-farms-${Date.now()}`, data });
  } catch (error) {
    return handleServerError(error);
  }
}

export async function POST(req: NextRequest) {
  if (!isSemseRuntimeEnabled()) return runtimeDisabledResponse();
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: { status: 400, message: "Invalid JSON body" } }, { status: 400 });
  }
  try {
    const data = await fetchSemseDataForRequest("/v1/agro/farms", req, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return NextResponse.json({ requestId: `agro-farm-create-${Date.now()}`, data }, { status: 201 });
  } catch (error) {
    return handleServerError(error);
  }
}
