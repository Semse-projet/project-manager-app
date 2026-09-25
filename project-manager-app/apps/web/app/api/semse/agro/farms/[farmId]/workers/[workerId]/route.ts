import type { NextRequest } from "next/server";
import { enc, proxyAgro } from "../../../../_agro-proxy";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ farmId: string; workerId: string }> }) {
  const { farmId, workerId } = await params;
  return proxyAgro(req, `/v1/agro/farms/${enc(farmId)}/workers/${enc(workerId)}`, "GET");
}
