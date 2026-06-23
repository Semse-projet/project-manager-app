import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, isSemseRuntimeEnabled, runtimeDisabledResponse } from "../../_server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isSemseRuntimeEnabled()) return runtimeDisabledResponse();
  try {
    const data = await fetchSemseDataForRequest<unknown>("/v1/agro/farms", req);
    return NextResponse.json({ data });
  } catch (err) {
    return handleServerError(err);
  }
}

export async function POST(req: NextRequest) {
  if (!isSemseRuntimeEnabled()) return runtimeDisabledResponse();
  try {
    const body = await req.json();
    const data = await fetchSemseDataForRequest<unknown>("/v1/agro/farms", req, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    return handleServerError(err);
  }
}
