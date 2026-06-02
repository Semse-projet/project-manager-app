import { NextRequest, NextResponse } from "next/server";

const OFFLINE_KNOWLEDGE: Record<string, string[]> = {
  "smart": ["keypad entry", "remote access", "biometric", "integration", "backup power"],
  "weather": ["gasket types", "door sweep", "weatherstripping", "threshold", "efficiency"],
  "accessibility": ["ADA requirements", "grab bars", "opener forces", "door widths"],
  "security": ["reinforced frames", "strike plates", "deadbolts", "hinge strength"],
  "repair": ["water damage", "cracks", "alignment", "reinforcement", "finishing"],
};

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();
    const lower = query.toLowerCase();
    const results = Object.entries(OFFLINE_KNOWLEDGE)
      .filter(([k]) => k.includes(lower))
      .flatMap(([, v]) => v)
      .slice(0, 5);
    return NextResponse.json({ results: results.length ? results : ["Check local building codes"] });
  } catch {
    return NextResponse.json({ results: ["Door modification guidance from contractors"] });
  }
}
