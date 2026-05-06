import { NextRequest, NextResponse } from "next/server";
import { fetchSemseData, handleServerError, isSemseRuntimeEnabled, runtimeDisabledResponse } from "../../../_server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isSemseRuntimeEnabled()) return runtimeDisabledResponse();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { status: 400, message: "Invalid JSON body" } }, { status: 400 });
  }

  try {
    const data = await fetchSemseData("/v1/buildops/estimates/from-tool-result", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return NextResponse.json({ requestId: `buildops-estimate-${Date.now()}`, data }, { status: 201 });
  } catch (error) {
    return handleServerError(error);
  }
}
