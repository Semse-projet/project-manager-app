import { NextRequest, NextResponse } from "next/server";

const OFFLINE_KNOWLEDGE: Record<string, string[]> = {
  "r-value": ["R13 specifications", "R15 applications", "R19 recommendations", "R21 performance", "climate zone selection"],
  "fiberglass": ["batts", "blown-in", "faced insulation", "fire resistance", "installation safety"],
  "cellulose": ["eco-friendly", "recycled content", "settling rates", "air sealing", "moisture management"],
  "spray foam": ["closed-cell", "open-cell", "air sealing properties", "soundproofing", "application costs"],
  "installation": ["attic insulation", "wall cavities", "basement", "crawlspace", "vapor barriers"],
};

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();
    const lower = query.toLowerCase();
    const results = Object.entries(OFFLINE_KNOWLEDGE)
      .filter(([k]) => k.includes(lower))
      .flatMap(([, v]) => v)
      .slice(0, 5);
    return NextResponse.json({ results: results.length ? results : ["Energy efficiency guidance from building science professionals"] });
  } catch (e) {
    return NextResponse.json({ results: ["Insulation installation guidance available through qualified contractors"] });
  }
}
