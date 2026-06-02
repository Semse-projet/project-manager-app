import { NextRequest, NextResponse } from "next/server";

const OFFLINE_KNOWLEDGE: Record<string, string[]> = {
  "beam": ["load calculations", "support methods", "material selection", "temporary bracing"],
  "foundation": ["soil assessment", "underpinning", "waterproofing", "settlement monitoring"],
  "bracing": ["lateral bracing", "diagonal bracing", "connection design", "seismic compliance"],
  "post": ["support requirements", "concrete footings", "frost protection", "connection details"],
  "reinforcement": ["code requirements", "rebar sizing", "epoxy injection", "structural analysis"],
};

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();
    const lower = query.toLowerCase();
    const results = Object.entries(OFFLINE_KNOWLEDGE)
      .filter(([k]) => k.includes(lower))
      .flatMap(([, v]) => v)
      .slice(0, 5);
    return NextResponse.json({ results: results.length ? results : ["Professional structural engineering required"] });
  } catch {
    return NextResponse.json({ results: ["Structural work requires licensed engineers"] });
  }
}
