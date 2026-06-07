import type { NextRequest } from "next/server";
export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json() as { query: string };
    if (!query?.trim()) return Response.json({ error: "Query required" }, { status: 400 });
    const knowledge = {
      brick: "Brick is durable, fire-resistant, and aesthetically pleasing.",
      stone: "Natural stone offers elegance and longevity.",
      mortar: "Proper mortar composition affects durability and appearance.",
      pattern: "Different patterns (running bond, Flemish) affect labor and aesthetics.",
      restoration: "Historic masonry requires specialized knowledge for preservation.",
    };
    const results = Object.entries(knowledge)
      .filter(([key]) => key.includes(query.toLowerCase()))
      .map(([k, v]) => ({ section: k, content: v, relevance: 0.8 }));
    return Response.json({
      query,
      results: results.length > 0 ? results : [{ section: "general", content: "Consult a master mason for complex projects.", relevance: 0.5 }],
      timestamp: new Date().toISOString(),
    });
  } catch { return Response.json({ error: "Research unavailable" }, { status: 500 }); }
}
