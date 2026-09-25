import type { NextRequest } from "next/server";
import { proxyAgro } from "../../_agro-proxy";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return proxyAgro(req, "/v1/agro/workforce/catalog", "GET");
}
