import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, isApiBaseConfigured, runtimeDisabledResponse } from "../../_server";

export const dynamic = "force-dynamic";

// Sense Vision live frame → API → semse-vision (spec: vision/sense-vision-field-library §5.2).
// Only the three image fields are forwarded; the frame is never stored here.
export async function POST(req: NextRequest) {
  if (!isApiBaseConfigured()) return runtimeDisabledResponse();
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const payload = {
      ...(typeof body.imageUrl === "string" ? { imageUrl: body.imageUrl } : {}),
      ...(typeof body.imageData === "string" ? { imageData: body.imageData } : {}),
      ...(typeof body.mimeType === "string" ? { mimeType: body.mimeType } : {}),
    };
    const data = await fetchSemseDataForRequest("/v1/vision/recognize", req, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    return NextResponse.json({ requestId: "web-vision-recognize", data });
  } catch (e) { return handleServerError(e); }
}
