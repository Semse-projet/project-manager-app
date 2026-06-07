import type { NextRequest } from "next/server";
export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json() as { query: string };
    if (!query?.trim()) return Response.json({ error: "Query required" }, { status: 400 });
    const knowledge = {
      standard: "Standard concrete is appropriate for most applications; cost-effective solution.",
      reinforced: "Reinforced concrete with rebar provides structural strength for load-bearing applications.",
      finishing: "Proper finishing improves aesthetics and durability; broom, smooth, and exposed aggregate are common.",
      curing: "Concrete requires proper curing time (7-28 days) for strength development.",
      preparation: "Site prep including grading and compaction is critical for long-term durability.",
    };
    const results = Object.entries(knowledge)
      .filter(([key]) => key.includes(query.toLowerCase()))
      .map(([k, v]) => ({ section: k, content: v, relevance: 0.8 }));
    return Response.json({
      query,
      results: results.length > 0 ? results : [{ section: "general", content: "Consult a concrete specialist for your project needs.", relevance: 0.5 }],
      timestamp: new Date().toISOString(),
    });
  } catch { return Response.json({ error: "Research unavailable" }, { status: 500 }); }
}
