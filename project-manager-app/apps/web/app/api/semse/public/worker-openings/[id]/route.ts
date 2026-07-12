import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) {
    return NextResponse.json({ error: { message: "Invalid opening id" } }, { status: 400 });
  }

  try {
    const apiBase = process.env.SEMSE_API_BASE_URL ?? "http://127.0.0.1:4000";
    const response = await fetch(`${apiBase}/v1/intelligence/public/openings/${encodeURIComponent(id)}`, {
      cache: "no-store",
      headers: {
        "x-tenant-id": process.env.SEMSE_TENANT_ID ?? "tenant_default",
      },
    });

    const json = await response.json() as { data?: unknown; error?: { message?: string } };
    if (!response.ok) {
      return NextResponse.json(
        { error: { message: json.error?.message ?? "Vacante no encontrada." } },
        { status: response.status },
      );
    }

    return NextResponse.json({ data: json.data });
  } catch {
    return NextResponse.json({ error: { message: "Service unavailable" } }, { status: 503 });
  }
}
