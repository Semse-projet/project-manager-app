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

    const sidingKnowledge = {
      vinyl: "Vinyl siding is affordable, low-maintenance, and available in many colors and styles.",
      "fiber cement": "Fiber cement combines wood-like appearance with superior durability and fire resistance.",
      wood: "Wood siding offers natural beauty but requires regular maintenance and staining.",
      metal: "Metal siding is durable, lightweight, and excellent for modern designs.",
      brick: "Brick veneer provides timeless elegance and requires minimal maintenance.",
      stone: "Stone siding creates a premium appearance and offers excellent durability.",
      installation: "Proper siding installation includes substrate preparation, flashing, and sealing.",
      maintenance: "Regular maintenance extends siding life: cleaning, resealing, and damage repair.",
    };

    const searchKey = query.toLowerCase();
    const results = Object.entries(sidingKnowledge)
      .filter(([key, _]) => key.includes(searchKey))
      .slice(0, maxResults)
      .map(([key, value]) => ({ section: key, content: value, relevance: 0.8 }));

    return Response.json({
      query,
      results: results.length > 0 ? results : [{ section: "general", content: "Consult a siding professional for your climate and budget needs.", relevance: 0.5 }],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Siding research error:", error);
    return Response.json({ error: "Research unavailable" }, { status: 500 });
  }
}
