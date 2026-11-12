import type { NextRequest } from "next/server";
import { proxyAuthenticated, readJsonBody, segment } from "../../../../../_authenticated-proxy";

type Ctx = { params: Promise<{ projectId: string; calendarId: string }> };

const RECIPIENTS = new Set(["owner", "general_contractor", "lender", "architect"]);

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, context: Ctx) {
  const { projectId, calendarId } = await context.params;
  const body = await readJsonBody(request);
  const recipientType = typeof body.recipientType === "string" && RECIPIENTS.has(body.recipientType)
    ? body.recipientType
    : undefined;
  return proxyAuthenticated(
    request,
    `/v1/projects/${segment(projectId)}/liens/calendar/${segment(calendarId)}/generate-notice`,
    { method: "POST", body: recipientType ? { recipientType } : {}, status: 201 }
  );
}
