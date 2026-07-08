import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, isSemseRuntimeEnabled, runtimeDisabledResponse } from "../../../_server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isSemseRuntimeEnabled()) return runtimeDisabledResponse();
  try {
    const body = await req.json();
    const data = await fetchSemseDataForRequest<unknown>(`/v1/agro/simulator/purchase`, req, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return NextResponse.json({ data });
  } catch (err) {
    return handleServerError(err);
  }
}
