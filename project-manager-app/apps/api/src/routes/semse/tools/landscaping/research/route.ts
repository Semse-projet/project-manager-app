import { NextRequest, NextResponse } from "next/server";

const OFFLINE_KNOWLEDGE: Record<string, string[]> = {
  "landscaping design": ["native plants", "hardscape materials", "outdoor living spaces", "sustainable landscaping", "xeriscaping principles"],
  "lawn care": ["grass types", "watering schedules", "fertilization", "weed control", "aeration and overseeding"],
  "hardscape": ["patios", "walkways", "retaining walls", "drainage solutions", "material selection"],
  "tree service": ["pruning techniques", "tree removal", "stump grinding", "health assessment", "disease prevention"],
  "maintenance": ["seasonal care", "spring cleanup", "fall preparation", "winter protection", "equipment maintenance"],
};

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();
    const lower = query.toLowerCase();
    const results = Object.entries(OFFLINE_KNOWLEDGE)
      .filter(([k]) => k.includes(lower))
      .flatMap(([, v]) => v)
      .slice(0, 5);
    return NextResponse.json({ results: results.length ? results : ["Check local landscaping suppliers for design inspiration"] });
  } catch (e) {
    return NextResponse.json({ results: ["Landscaping design guidance available through professional consultants"] });
  }
}
