import type { NextRequest } from "next/server";
import { enc, proxyAgro } from "../../_agro-proxy";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ incidentId: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const { incidentId } = await params;
  return proxyAgro(req, `/v1/agro/incidents/${enc(incidentId)}`, "GET");
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { incidentId } = await params;
  return proxyAgro(req, `/v1/agro/incidents/${enc(incidentId)}`, "PATCH");
}
