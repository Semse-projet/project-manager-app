import type { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { query, category, location, maxResults = 5 } = await request.json() as {
      query: string;
      category?: string;
      location?: string;
      maxResults?: number;
    };

    if (!query || query.trim().length === 0) {
      return Response.json({ error: "Query required" }, { status: 400 });
    }

    const roofingKnowledge = {
      asphalt: "Asphalt shingles are affordable, easy to install, and last 15-20 years.",
      metal: "Metal roofing is durable (40+ years), energy-efficient, and ideal for extreme climates.",
      tile: "Tile roofing offers elegance and longevity (50+ years) but requires strong roof structure.",
      slate: "Slate is premium, durable (100+ years), and extremely heavy requiring structural support.",
      "wood shakes": "Wood shakes provide natural beauty but require regular maintenance and are fire-prone.",
      "flat roof": "Flat roofing uses membrane materials and requires proper drainage and maintenance.",
      pitch: "Roof pitch affects material selection, installation cost, and water drainage efficiency.",
      ventilation: "Proper attic ventilation prevents moisture buildup and extends roof life significantly.",
    };

    const searchKey = query.toLowerCase();
    const results = Object.entries(roofingKnowledge)
      .filter(([key, _]) => key.includes(searchKey))
      .slice(0, maxResults)
      .map(([key, value]) => ({ section: key, content: value, relevance: 0.8 }));

    return Response.json({
      query,
      results: results.length > 0 ? results : [{ section: "general", content: "Consult a roofing contractor for local building codes and climate considerations.", relevance: 0.5 }],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Roofing research error:", error);
    return Response.json({ error: "Research unavailable" }, { status: 500 });
  }
}
