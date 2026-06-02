import { NextRequest, NextResponse } from "next/server";

const OFFLINE_KNOWLEDGE: Record<string, string[]> = {
  "hvac": ["smart thermostats", "zoning systems", "variable speed", "occupancy sensors"],
  "solar": ["battery pairing", "grid-tie design", "load balancing", "monitoring"],
  "ev": ["charging levels", "connector types", "home installation", "load management"],
  "battery": ["capacity planning", "chemistry selection", "backup duration", "grid support"],
  "automation": ["integration platforms", "voice control", "scheduling", "monitoring"],
};

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();
    const lower = query.toLowerCase();
    const results = Object.entries(OFFLINE_KNOWLEDGE)
      .filter(([k]) => k.includes(lower))
      .flatMap(([, v]) => v)
      .slice(0, 5);
    return NextResponse.json({ results: results.length ? results : ["Consult electrical professionals"] });
  } catch {
    return NextResponse.json({ results: ["Advanced electrical systems require professional engineering"] });
  }
}
