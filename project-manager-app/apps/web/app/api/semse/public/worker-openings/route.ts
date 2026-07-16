import { type NextRequest, NextResponse } from "next/server";
import { generalizePublicLocation, redactPublicText } from "@semse/schemas";

export const dynamic = "force-dynamic";

type OpeningLike = { title?: unknown; scope?: unknown; location?: unknown };

/** Defensa en profundidad: re-aplica el contrato de privacidad pública del API. */
function sanitizeOpening<T extends OpeningLike>(opening: T): T {
  return {
    ...opening,
    title: redactPublicText(String(opening.title ?? ""), 120),
    scope: redactPublicText(String(opening.scope ?? ""), 280),
    location: generalizePublicLocation(opening.location ? String(opening.location) : null),
  };
}

export async function GET(request: NextRequest) {
  try {
    const limit = request.nextUrl.searchParams.get("limit") ?? "12";
    const apiBase = process.env.SEMSE_API_BASE_URL ?? "http://127.0.0.1:4000";
    const response = await fetch(`${apiBase}/v1/intelligence/public/openings?limit=${encodeURIComponent(limit)}`, {
      cache: "no-store",
      headers: {
        "x-tenant-id": process.env.SEMSE_TENANT_ID ?? "tenant_default",
      },
    });

    const json = await response.json() as { data?: unknown; error?: { message?: string } };
    if (!response.ok) {
      return NextResponse.json(
        { error: { message: json.error?.message ?? "No se pudieron cargar las vacantes." } },
        { status: response.status },
      );
    }

    const data = Array.isArray(json.data)
      ? (json.data as OpeningLike[]).map(sanitizeOpening)
      : json.data;
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: { message: "Service unavailable" } }, { status: 503 });
  }
}
