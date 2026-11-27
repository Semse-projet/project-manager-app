import type { NextRequest } from "next/server";
import { proxyAuthenticated, segment } from "../../../_authenticated-proxy";

type Ctx = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export async function DELETE(request: NextRequest, context: Ctx) {
  const { id } = await context.params;
  return proxyAuthenticated(request, `/v1/satellites/tokens/${segment(id)}`, { method: "DELETE" });
}
