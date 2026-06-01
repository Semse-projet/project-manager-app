import { NextRequest, NextResponse } from "next/server";

const OFFLINE_KNOWLEDGE: Record<string, string[]> = {
  "prevailing wages": ["regional rates", "skill levels", "fringe benefits", "apprenticeship programs", "union standards"],
  "crew management": ["scheduling", "safety protocols", "productivity metrics", "communication tools", "time tracking"],
  "labor laws": ["minimum wage", "overtime requirements", "worker classification", "liability insurance", "workers compensation"],
  "productivity": ["output standards", "quality benchmarks", "efficiency metrics", "training requirements", "skill development"],
  "safety": ["OSHA requirements", "PPE standards", "hazard assessment", "incident reporting", "training compliance"],
};

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();
    const lower = query.toLowerCase();
    const results = Object.entries(OFFLINE_KNOWLEDGE)
      .filter(([k]) => k.includes(lower))
      .flatMap(([, v]) => v)
      .slice(0, 5);
    return NextResponse.json({ results: results.length ? results : ["Review labor standards with HR professionals"] });
  } catch (e) {
    return NextResponse.json({ results: ["Labor guidelines available from industry associations"] });
  }
}
