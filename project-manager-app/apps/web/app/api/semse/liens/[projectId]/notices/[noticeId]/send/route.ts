import type { NextRequest } from "next/server";
import { proxyAuthenticated, segment } from "../../../../../_authenticated-proxy";

type Ctx = { params: Promise<{ projectId: string; noticeId: string }> };

export const dynamic = "force-dynamic";

// Sends a real certified letter through Lob (billable). The UI asks for an
// explicit confirmation before calling this route.
export async function POST(request: NextRequest, context: Ctx) {
  const { projectId, noticeId } = await context.params;
  return proxyAuthenticated(
    request,
    `/v1/projects/${segment(projectId)}/liens/notices/${segment(noticeId)}/send`,
    { method: "POST" }
  );
}
