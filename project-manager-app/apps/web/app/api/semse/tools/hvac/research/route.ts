import type { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json() as { query: string };
    if (!query?.trim()) return Response.json({ error: "Query required" }, { status: 400 });

    const knowledge = {
      "seer": "SEER (Seasonal Energy Efficiency Ratio) measures AC efficiency; higher = more efficient.",
      "central": "Central air conditioning provides whole-home cooling via ducts.",
      "heat pump": "Heat pumps provide both heating and cooling by moving warm air.",
      "efficiency": "High-efficiency systems reduce energy costs and environmental impact.",
      "maintenance": "Regular HVAC maintenance extends equipment life and improves performance.",
      "ductwork": "Proper ductwork design ensures even airflow and comfort throughout home.",
      "zoning": "Multi-zone systems allow independent temperature control in different areas.",
    };

    const results = Object.entries(knowledge)
      .filter(([key]) => key.includes(query.toLowerCase()))
      .map(([k, v]) => ({ section: k, content: v, relevance: 0.8 }));

    return Response.json({
      query,
      results: results.length > 0 ? results : [{ section: "general", content: "Consult an HVAC professional for system sizing and design.", relevance: 0.5 }],
      timestamp: new Date().toISOString(),
    });
  } catch {
    return Response.json({ error: "Research unavailable" }, { status: 500 });
  }
}
