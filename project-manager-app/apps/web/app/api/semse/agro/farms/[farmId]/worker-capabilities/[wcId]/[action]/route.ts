import type { NextRequest } from "next/server";
import { enc, notFound, proxyAgro } from "../../../../../_agro-proxy";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ farmId: string; wcId: string; action: string }> };
const POST_ACTIONS = new Set(["verify", "revoke", "evidence", "request-review"]);

export async function GET(req: NextRequest, { params }: Ctx) {
  const { farmId, wcId, action } = await params;
  if (action !== "timeline") return notFound();
  return proxyAgro(req, `/v1/agro/farms/${enc(farmId)}/worker-capabilities/${enc(wcId)}/timeline`, "GET");
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { farmId, wcId, action } = await params;
  if (!POST_ACTIONS.has(action)) return notFound();
  return proxyAgro(req, `/v1/agro/farms/${enc(farmId)}/worker-capabilities/${enc(wcId)}/${action}`, "POST");
}
