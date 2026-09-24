import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, isApiBaseConfigured, runtimeDisabledResponse } from "../../../_server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ idOrSlug: string }> }) {
  if (!isApiBaseConfigured()) return runtimeDisabledResponse();
  const { idOrSlug } = await params;
  try {
    const data = await fetchSemseDataForRequest(`/v1/vision/library/${encodeURIComponent(idOrSlug)}`, req);
    return NextResponse.json({ requestId: "web-vision-library-item", data });
  } catch (e) { return handleServerError(e); }
}
