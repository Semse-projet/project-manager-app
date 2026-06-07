import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseData } from "../../_server";

export async function GET(_request: NextRequest) {
  try {
    const stats = await fetchSemseData<{ total?: number }>("/v1/ai-models/logs/stats");
    return NextResponse.json({
      data: {
        totalDecisions: stats.total ?? 0,
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
