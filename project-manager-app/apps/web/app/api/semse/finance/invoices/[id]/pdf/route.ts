import { type NextRequest, NextResponse } from "next/server";
import { buildSemseRequestHeaders, getServerConfig, runtimeDisabledResponse } from "../../../../_server";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const cfg = await getServerConfig(request);
    const headers = buildSemseRequestHeaders(cfg);
    const type = request.nextUrl.searchParams.get("type") ?? "";
    const qs = type ? `?type=${encodeURIComponent(type)}` : "";

    const apiRes = await fetch(`${cfg.apiBaseUrl}/v1/finance/invoices/${id}/pdf${qs}`, { headers });

    if (!apiRes.ok) {
      return runtimeDisabledResponse();
    }

    const buf = await apiRes.arrayBuffer();
    const filename = apiRes.headers.get("Content-Disposition") ?? `attachment; filename="document.pdf"`;

    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": filename,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return runtimeDisabledResponse();
  }
}
