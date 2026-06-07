import type { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json() as { query: string };
    if (!query?.trim()) return Response.json({ error: "Query required" }, { status: 400 });

    const knowledge = {
      "vinyl": "Vinyl windows are affordable, low-maintenance, and energy-efficient.",
      "wood": "Wood windows offer classic beauty but require regular maintenance and sealing.",
      "fiberglass": "Fiberglass is durable, strong, and excellent for extreme climates.",
      "double pane": "Double-pane windows with low-E coating reduce heating/cooling costs significantly.",
      "energy star": "Energy Star certified windows meet strict efficiency standards.",
      "installation": "Proper installation prevents air leaks and water infiltration.",
      "weathersealing": "Quality weathersealing prevents drafts and extends window lifespan.",
    };

    const results = Object.entries(knowledge)
      .filter(([key]) => key.includes(query.toLowerCase()))
      .map(([k, v]) => ({ section: k, content: v, relevance: 0.8 }));

    return Response.json({
      query,
      results: results.length > 0 ? results : [{ section: "general", content: "Consult a windows & doors specialist for your climate zone.", relevance: 0.5 }],
      timestamp: new Date().toISOString(),
    });
  } catch {
    return Response.json({ error: "Research unavailable" }, { status: 500 });
  }
}
