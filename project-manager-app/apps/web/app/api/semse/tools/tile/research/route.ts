import type { NextRequest } from "next/server";
export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json() as { query: string };
    if (!query?.trim()) return Response.json({ error: "Query required" }, { status: 400 });
    const knowledge = {
      ceramic: "Ceramic is affordable and easy to maintain.",
      porcelain: "Porcelain is dense, durable, and suitable for high-traffic areas.",
      "natural stone": "Stone tiles offer luxury appearance but require sealing.",
      grout: "Proper grout selection affects durability and appearance.",
      waterproofing: "Critical in wet areas; prevents substrate damage.",
    };
    const results = Object.entries(knowledge)
      .filter(([key]) => key.includes(query.toLowerCase()))
      .map(([k, v]) => ({ section: k, content: v, relevance: 0.8 }));
    return Response.json({
      query,
      results: results.length > 0 ? results : [{ section: "general", content: "Consult a tile specialist for design help.", relevance: 0.5 }],
      timestamp: new Date().toISOString(),
    });
  } catch { return Response.json({ error: "Research unavailable" }, { status: 500 }); }
}
