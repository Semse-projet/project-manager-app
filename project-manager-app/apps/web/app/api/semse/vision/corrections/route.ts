import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, isApiBaseConfigured, runtimeDisabledResponse } from "../../_server";

export const dynamic = "force-dynamic";

// "No es esto / Not this?" — recorded for evaluation only.
export async function POST(req: NextRequest) {
  if (!isApiBaseConfigured()) return runtimeDisabledResponse();
  try {
    const body = await req.json().catch(() => ({}));
    const data = await fetchSemseDataForRequest("/v1/vision/corrections", req, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return NextResponse.json({ requestId: "web-vision-correction", data }, { status: 201 });
  } catch (e) { return handleServerError(e); }
}
