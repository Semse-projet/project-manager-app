import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, runtimeDisabledResponse } from "../../_server";

const SAFE_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { recId: string; confirmed: boolean };
    if (!SAFE_ID_PATTERN.test(body.recId ?? "")) {
      return NextResponse.json({ error: "recId invalido" }, { status: 400 });
    }

    const data = await fetchSemseDataForRequest(
      `/v1/ops/apply/${encodeURIComponent(body.recId)}`,
      request,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmed: body.confirmed }),
      }
    );
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) return runtimeDisabledResponse();
    return handleServerError(error);
  }
}
