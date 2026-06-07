import type { NextRequest } from "next/server";
export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json() as { query: string };
    if (!query?.trim()) return Response.json({ error: "Query required" }, { status: 400 });
    const knowledge = {
      "pressure treated": "PT lumber is affordable and rot-resistant; standard choice for deck framing.",
      cedar: "Cedar provides natural beauty and durability; requires regular maintenance.",
      composite: "Composite decking lasts 25+ years with minimal maintenance.",
      structure: "Proper footings below frost line are essential for structural integrity.",
      maintenance: "Annual cleaning and sealing extends deck lifespan significantly.",
    };
    const results = Object.entries(knowledge)
      .filter(([key]) => key.includes(query.toLowerCase()))
      .map(([k, v]) => ({ section: k, content: v, relevance: 0.8 }));
    return Response.json({
      query,
      results: results.length > 0 ? results : [{ section: "general", content: "Consult a deck builder for design assistance.", relevance: 0.5 }],
      timestamp: new Date().toISOString(),
    });
  } catch { return Response.json({ error: "Research unavailable" }, { status: 500 }); }
}
