import { NextRequest, NextResponse } from "next/server";
import { fetchSemseData, handleServerError, isSemseRuntimeEnabled, runtimeDisabledResponse } from "../../_server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isSemseRuntimeEnabled()) {
    return runtimeDisabledResponse();
  }

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const data = await fetchSemseData("/v1/ops/incidents", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(body)
    });

    return NextResponse.json({ requestId: "web-ops-incidents", data });
  } catch (error) {
    return handleServerError(error);
  }
}
