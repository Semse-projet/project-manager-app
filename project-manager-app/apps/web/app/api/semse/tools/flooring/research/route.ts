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

    // Fallback: offline knowledge base
    const flooringKnowledge = {
      vinyl: "Vinyl flooring is durable, waterproof, and affordable. Great for kitchens and bathrooms.",
      laminate: "Laminate offers wood-like appearance with durability and easy maintenance.",
      tile: "Ceramic and porcelain tile are highly durable, waterproof, and available in many designs.",
      hardwood: "Hardwood provides elegance and warmth, requires sealing and periodic refinishing.",
      bamboo: "Bamboo is eco-friendly, hard-wearing, and offers a unique aesthetic.",
      stone: "Natural stone (marble, granite) is luxurious but requires professional installation and maintenance.",
      installation: "Professional flooring installation requires proper subfloor prep, underlayment, and expert technique.",
      "floor prep": "Floor preparation includes removing old flooring, leveling the subfloor, and moisture testing.",
      herringbone: "Herringbone pattern creates visual interest but requires more skilled installation.",
      patterns: "Common patterns: straight lay, diagonal, herringbone, random. More complex patterns increase labor costs.",
    };

    const searchKey = query.toLowerCase();
    const results = Object.entries(flooringKnowledge)
      .filter(([key, _]) => key.includes(searchKey))
      .slice(0, maxResults)
      .map(([key, value]) => ({ section: key, content: value, relevance: 0.8 }));

    return Response.json({
      query,
      results: results.length > 0 ? results : [{ section: "general", content: "Consult with a flooring professional for your specific project needs.", relevance: 0.5 }],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Flooring research error:", error);
    return Response.json({ error: "Research unavailable" }, { status: 500 });
  }
}
