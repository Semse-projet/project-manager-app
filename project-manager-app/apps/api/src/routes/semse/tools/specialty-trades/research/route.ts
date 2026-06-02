import { NextRequest, NextResponse } from "next/server";

const OFFLINE_KNOWLEDGE: Record<string, string[]> = {
  "pool": ["excavation planning", "permits required", "equipment selection", "filtration systems"],
  "sauna": ["electrical requirements", "ventilation design", "waterproofing", "equipment selection"],
  "carpentry": ["material selection", "joinery techniques", "finishing options", "design consultation"],
  "stone": ["stone selection", "mortar types", "pattern options", "restoration techniques"],
  "fireplace": ["chimney sizing", "damper selection", "hearth requirements", "ventilation"],
};

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();
    const lower = query.toLowerCase();
    const results = Object.entries(OFFLINE_KNOWLEDGE)
      .filter(([k]) => k.includes(lower))
      .flatMap(([, v]) => v)
      .slice(0, 5);
    return NextResponse.json({ results: results.length ? results : ["Specialty trades require licensed craftspeople"] });
  } catch {
    return NextResponse.json({ results: ["Specialty installation guidance from expert tradespeople"] });
  }
}
