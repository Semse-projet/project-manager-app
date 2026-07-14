import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, isSemseRuntimeEnabled, runtimeDisabledResponse } from "../../../../_server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ groupId: string }> }) {
  if (!isSemseRuntimeEnabled()) return runtimeDisabledResponse();
  try {
    const { groupId } = await params;
    const body = await req.json();
    const data = await fetchSemseDataForRequest<unknown>(`/v1/agro/animal-groups/${groupId}/sell`, req, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    return handleServerError(err);
  }
}
