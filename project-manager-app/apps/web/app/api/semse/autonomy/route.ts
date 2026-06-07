import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, isApiBaseConfigured, runtimeDisabledResponse } from "../_server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isApiBaseConfigured()) {
    return runtimeDisabledResponse();
  }

  try {
    const data = await fetchSemseDataForRequest("/v1/autonomy/runs", req);
    return NextResponse.json({ requestId: "web-autonomy-runs", data });
  } catch (error) {
    return handleServerError(error);
  }
}

export async function POST(req: NextRequest) {
  if (!isApiBaseConfigured()) {
    return runtimeDisabledResponse();
  }

  try {
    const body = await req.json();
    const data = await fetchSemseDataForRequest("/v1/autonomy/runs", req, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    return NextResponse.json({ requestId: "web-autonomy-run-create", data });
  } catch (error) {
    return handleServerError(error);
  }
}
