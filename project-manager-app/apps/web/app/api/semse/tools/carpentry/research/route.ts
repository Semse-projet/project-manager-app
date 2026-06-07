import { type NextRequest, NextResponse } from "next/server";

type ResearchCategory = "materials" | "technique" | "code" | "safety" | "general";

type ResearchResult = {
  title: string;
  url: string;
  snippet: string;
  source?: string;
};

type ResearchResponse = {
  provider: "brave" | "tavily" | "offline";
  query: string;
  category: ResearchCategory;
  generatedAt: string;
  answer?: string;
  results: ResearchResult[];
  recommendations: string[];
  gates: string[];
  warnings: string[];
};

function buildFallback(query: string, category: ResearchCategory): ResearchResponse {
  return {
    provider: "offline",
    query,
    category,
    generatedAt: new Date().toISOString(),
    answer: "Internet research provider not configured.",
    results: [],
    recommendations: [
      "Configure BRAVE_SEARCH_API_KEY or TAVILY_API_KEY for live research."
    ],
    gates: [],
    warnings: ["No live internet provider configured."],
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const query = typeof body.query === "string" ? body.query.trim() : "";
    if (!query) {
      return NextResponse.json({ error: { message: "query is required" } }, { status: 400 });
    }

    return NextResponse.json({ data: buildFallback(query, "general") });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Research failed";
    return NextResponse.json({ error: { message } }, { status: 500 });
  }
}
