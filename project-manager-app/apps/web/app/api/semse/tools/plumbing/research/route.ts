import type { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json() as { query: string };
    if (!query?.trim()) return Response.json({ error: "Query required" }, { status: 400 });

    const knowledge = {
      "pvc": "PVC pipes are affordable, durable, and ideal for modern plumbing installations.",
      "copper": "Copper pipes are long-lasting but expensive; great for water main applications.",
      "pex": "PEX is flexible, frost-resistant, and easier to install than rigid pipes.",
      "fixture": "Plumbing fixtures include sinks, toilets, showers; sizing is critical for proper flow.",
      "code": "Plumbing codes vary by jurisdiction; permits ensure safety and proper installation.",
      "leak": "Common leak sources: joints, fixtures, aging pipes. Early detection prevents water damage.",
      "pressure": "Water pressure testing ensures system integrity and code compliance.",
    };

    const results = Object.entries(knowledge)
      .filter(([key]) => key.includes(query.toLowerCase()))
      .map(([k, v]) => ({ section: k, content: v, relevance: 0.8 }));

    return Response.json({
      query,
      results: results.length > 0 ? results : [{ section: "general", content: "Consult a licensed plumber for your specific needs.", relevance: 0.5 }],
      timestamp: new Date().toISOString(),
    });
  } catch {
    return Response.json({ error: "Research unavailable" }, { status: 500 });
  }
}
