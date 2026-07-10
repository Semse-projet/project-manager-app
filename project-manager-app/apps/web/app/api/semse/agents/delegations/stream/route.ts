import { type NextRequest } from "next/server";
import { buildAuthorizedHeaders, getServerConfig, runtimeDisabledResponse } from "../../../_server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const cfg = await getServerConfig(request);
    const headers = (await buildAuthorizedHeaders(cfg));

    const qs = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
    const apiRes = await fetch(
      `${cfg.apiBaseUrl}/v1/sse/delegations${qs}`,
      { headers, signal: request.signal },
    );

    if (!apiRes.ok || !apiRes.body) {
      return runtimeDisabledResponse();
    }

    return new Response(apiRes.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch {
    return runtimeDisabledResponse();
  }
}
