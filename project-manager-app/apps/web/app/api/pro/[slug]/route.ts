import { type NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const apiBase = process.env.SEMSE_API_BASE_URL ?? "http://127.0.0.1:4000";
    const res = await fetch(
      `${apiBase}/v1/intelligence/credentials/public/${encodeURIComponent(slug)}`,
      { headers: { "x-tenant-id": "tenant_default" }, cache: "no-store" },
    );
    if (!res.ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const json = await res.json() as { data?: unknown };
    return NextResponse.json({ data: json.data });
  } catch {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }
}
