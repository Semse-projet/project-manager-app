import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, isApiBaseConfigured, runtimeDisabledResponse } from "../_server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isApiBaseConfigured()) {
    return runtimeDisabledResponse();
  }

  try {
    const search = req.nextUrl.searchParams.toString();
    const path = search.length > 0 ? `/v1/domain-events?${search}` : "/v1/domain-events";
    const data = await fetchSemseDataForRequest(path, req);

    return NextResponse.json({
      requestId: "web-domain-events",
      data
    });
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
    const data = await fetchSemseDataForRequest("/v1/domain-events/emit", req, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });

    return NextResponse.json({
      requestId: "web-domain-events-emit",
      data
    });
  } catch (error) {
    return handleServerError(error);
  }
}
