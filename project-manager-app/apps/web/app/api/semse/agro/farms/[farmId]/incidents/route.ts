import type { NextRequest } from "next/server";
import { enc, proxyAgro } from "../../../_agro-proxy";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ farmId: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const { farmId } = await params;
  return proxyAgro(req, `/v1/agro/farms/${enc(farmId)}/incidents`, "GET");
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { farmId } = await params;
  return proxyAgro(req, `/v1/agro/farms/${enc(farmId)}/incidents`, "POST");
}
