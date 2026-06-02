import { NextRequest, NextResponse } from "next/server";

const OFFLINE_KNOWLEDGE: Record<string, string[]> = {
  "excavator": ["size classifications", "fuel types", "attachment options", "operator certification"],
  "crane": ["load capacity", "reach limitations", "rigging equipment", "certified operators"],
  "scaffolding": ["height specifications", "fall protection", "structural requirements", "assembly time"],
  "compressor": ["PSI ratings", "portable options", "tool compatibility", "maintenance requirements"],
  "lift": ["height capacity", "platform size", "stabilization requirements", "operator certification"],
};

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();
    const lower = query.toLowerCase();
    const results = Object.entries(OFFLINE_KNOWLEDGE)
      .filter(([k]) => k.includes(lower))
      .flatMap(([, v]) => v)
      .slice(0, 5);
    return NextResponse.json({ results: results.length ? results : ["Equipment rental terms vary by provider"] });
  } catch {
    return NextResponse.json({ results: ["Contact equipment rental companies for rates"] });
  }
}
