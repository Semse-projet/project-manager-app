import { NextRequest, NextResponse } from "next/server";

const OFFLINE_KNOWLEDGE: Record<string, string[]> = {
  "wood fencing": ["pressure-treated", "cedar", "composite alternatives", "maintenance", "rot prevention"],
  "vinyl fencing": ["low maintenance", "color options", "durability", "cost comparison", "installation"],
  "metal fencing": ["aluminum", "steel", "ornamental iron", "rust resistance", "decorative styles"],
  "installation": ["post spacing", "concrete footings", "post hole digging", "level and plumb", "gate installation"],
  "codes": ["property lines", "easements", "HOA requirements", "local permits", "setback regulations"],
};

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();
    const lower = query.toLowerCase();
    const results = Object.entries(OFFLINE_KNOWLEDGE)
      .filter(([k]) => k.includes(lower))
      .flatMap(([, v]) => v)
      .slice(0, 5);
    return NextResponse.json({ results: results.length ? results : ["Check local building codes before fencing installation"] });
  } catch (e) {
    return NextResponse.json({ results: ["Fencing guidelines available from professional installers"] });
  }
}
