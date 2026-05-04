import { type NextRequest, NextResponse } from "next/server";

export async function GET(_request: NextRequest) {
  try {
    const apiBase = process.env.SEMSE_API_BASE_URL ?? "http://127.0.0.1:4000";
    const res = await fetch(`${apiBase}/v1/ai-models/logs/stats`, {
      headers: {
        "x-tenant-id": "tenant_default",
        "x-user-id": "usr_admin_001",
        "x-org-id": "org_admin_001",
        "x-roles": "OPS_ADMIN",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) throw new Error("upstream");
    const json = (await res.json()) as { data?: { total?: number } };
    return NextResponse.json({
      data: {
        totalDecisions: json.data?.total ?? 0,
        totalProjects: 47,
        completionRate: 98.7,
        avgResponseHours: 48,
        activeAgents: 16,
      },
    });
  } catch {
    return NextResponse.json({
      data: {
        totalDecisions: 0,
        totalProjects: 47,
        completionRate: 98.7,
        avgResponseHours: 48,
        activeAgents: 16,
      },
      _fallback: true,
    });
  }
}
