import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, isApiBaseConfigured, runtimeDisabledResponse } from "../../../_server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ libraryItemId: string }> };

async function forward(req: NextRequest, ctx: Ctx, method: "POST" | "PATCH" | "DELETE") {
  if (!isApiBaseConfigured()) return runtimeDisabledResponse();
  const { libraryItemId } = await ctx.params;
  try {
    const body = method === "DELETE" ? undefined : JSON.stringify(await req.json().catch(() => ({})));
    const data = await fetchSemseDataForRequest(`/v1/vision/dictionary/${encodeURIComponent(libraryItemId)}`, req, {
      method,
      ...(body ? { body, headers: { "content-type": "application/json" } } : {}),
    });
    return NextResponse.json({ requestId: `web-vision-dictionary-${method.toLowerCase()}`, data });
  } catch (e) { return handleServerError(e); }
}

export const POST = (req: NextRequest, ctx: Ctx) => forward(req, ctx, "POST");
export const PATCH = (req: NextRequest, ctx: Ctx) => forward(req, ctx, "PATCH");
export const DELETE = (req: NextRequest, ctx: Ctx) => forward(req, ctx, "DELETE");
