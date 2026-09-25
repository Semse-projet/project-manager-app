import type { NextRequest } from "next/server";
import { enc, notFound, proxyAgro } from "../../../../../_agro-proxy";

export const dynamic = "force-dynamic";

const ACTIONS = new Set(["roles", "capabilities"]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ farmId: string; workerId: string; action: string }> }) {
  const { farmId, workerId, action } = await params;
  if (!ACTIONS.has(action)) return notFound();
  return proxyAgro(req, `/v1/agro/farms/${enc(farmId)}/workers/${enc(workerId)}/${action}`, "POST");
}
