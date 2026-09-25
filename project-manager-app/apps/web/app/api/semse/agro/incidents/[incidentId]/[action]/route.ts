import type { NextRequest } from "next/server";
import { enc, notFound, proxyAgro } from "../../../_agro-proxy";

export const dynamic = "force-dynamic";

const ACTIONS = new Set(["transition", "assign", "task", "comments", "evidence"]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ incidentId: string; action: string }> }) {
  const { incidentId, action } = await params;
  if (!ACTIONS.has(action)) return notFound();
  return proxyAgro(req, `/v1/agro/incidents/${enc(incidentId)}/${action}`, "POST");
}
