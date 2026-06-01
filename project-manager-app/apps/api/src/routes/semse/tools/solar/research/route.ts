import { NextRequest, NextResponse } from "next/server";

const OFFLINE_KNOWLEDGE: Record<string, string[]> = {
  "solar panels": ["monocrystalline", "polycrystalline", "thin-film", "efficiency ratings", "warranty terms"],
  "installation": ["roof mounting", "ground mounting", "structural assessment", "electrical integration", "permit requirements"],
  "battery storage": ["lithium-ion", "lead-acid", "capacity ratings", "depth of discharge", "cycle life"],
  "grid tie": ["net metering", "interconnection", "anti-islanding", "monitoring systems", "utility requirements"],
  "savings": ["energy offset", "tax credits", "rebates", "payback period", "long-term ROI"],
};

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();
    const lower = query.toLowerCase();
    const results = Object.entries(OFFLINE_KNOWLEDGE)
      .filter(([k]) => k.includes(lower))
      .flatMap(([, v]) => v)
      .slice(0, 5);
    return NextResponse.json({ results: results.length ? results : ["Consult certified solar installers for system design"] });
  } catch (e) {
    return NextResponse.json({ results: ["Solar energy guidance available through renewable energy specialists"] });
  }
}
