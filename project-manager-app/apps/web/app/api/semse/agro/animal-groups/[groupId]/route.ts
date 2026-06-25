import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, isSemseRuntimeEnabled, runtimeDisabledResponse } from "../../../../_server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ groupId: string }> }) {
  if (!isSemseRuntimeEnabled()) return runtimeDisabledResponse();
  try {
    const { groupId } = await params;
    const data = await fetchSemseDataForRequest<unknown>(`/v1/agro/animal-groups/${groupId}`, req);
    return NextResponse.json({ data });
  } catch (err) {
    return handleServerError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ groupId: string }> }) {
  if (!isSemseRuntimeEnabled()) return runtimeDisabledResponse();
  try {
    const { groupId } = await params;
    const body = await req.json();
    const data = await fetchSemseDataForRequest<unknown>(`/v1/agro/animal-groups/${groupId}`, req, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return NextResponse.json({ data });
  } catch (err) {
    return handleServerError(err);
  }
}
