import { NextRequest, NextResponse } from "next/server";
import { handleServerError, runtimeDisabledResponse, buildAuthorizedHeaders, getServerConfig } from "../../_server";

const API = process.env.SEMSE_API_BASE_URL ?? "http://localhost:4000";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { milestoneTitle: string; trade: string; locale?: "es" | "en" };
    const cfg  = await getServerConfig(request);

    // Dispatch MILESTONE_CREATED to Evidence Agent via message bus and get checklist
    const resp = await fetch(`${API}/v1/agents/semse/evidence/checklist`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(await buildAuthorizedHeaders(cfg)) },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      // Do not fabricate required evidence on auth or backend failure (including 401/403).
      return NextResponse.json(
        { error: { code: "EVIDENCE_CHECKLIST_UNAVAILABLE", message: "Evidence checklist unavailable" } },
        { status: resp.status },
      );
    }

    const json = await resp.json();
    return NextResponse.json(json);
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) return runtimeDisabledResponse();
    return handleServerError(error);
  }
}

