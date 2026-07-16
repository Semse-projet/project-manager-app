import { type NextRequest, NextResponse } from "next/server";

/**
 * BFF público de ingesta de Product Intelligence (PI-04.2).
 * Anónimo permitido: el consentimiento viaja en el batch y el API lo valida.
 * Kill switch: si PRODUCT_INTELLIGENCE_ENABLED no está activo en el API,
 * este proxy devuelve el mismo 403 (el SDK ya es no-op en ese caso).
 */
export async function POST(request: NextRequest) {
  const apiBaseUrl = process.env.SEMSE_API_BASE_URL?.trim().replace(/\/+$/, "");
  if (!apiBaseUrl) {
    return NextResponse.json({ error: "Backend no configurado" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const response = await fetch(`${apiBaseUrl}/v1/product-intelligence/ingest`, {
    method: "POST",
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      "x-tenant-id": process.env.SEMSE_TENANT_ID ?? "tenant_default",
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  return NextResponse.json(payload, {
    status: response.status,
    headers: { "cache-control": "no-store" },
  });
}
