import type { NextRequest } from "next/server";
import { enc, proxyAgro } from "../../../../_agro-proxy";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ farmId: string }> }) {
  const { farmId } = await params;
  return proxyAgro(req, `/v1/agro/farms/${enc(farmId)}/incidents/context`, "GET");
}
