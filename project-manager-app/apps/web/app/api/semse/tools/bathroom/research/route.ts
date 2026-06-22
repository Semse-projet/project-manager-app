import { type NextRequest, NextResponse } from "next/server";

type ResearchCategory = "materials" | "plumbing" | "code" | "waterproofing" | "safety" | "general";

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

const TRUSTED_SOURCES: ResearchResult[] = [
  {
    title: "Tile Council of America (TCA) Installation Guidelines",
    url: "https://www.tcnatile.com/",
    snippet: "Professional tile installation standards for wet areas and bathrooms.",
    source: "TCA",
  },
  {
    title: "National Kitchen & Bath Association (NKBA) Standards",
    url: "https://www.nkba.org/",
    snippet: "Code-based standards for bathroom design, fixtures, and accessibility.",
    source: "NKBA",
  },
  {
    title: "International Plumbing Code (IPC) & Residential Code",
    url: "https://www.iccsafe.org/",
    snippet: "Plumbing code requirements for fixture venting, spacing, and material.",
    source: "ICC",
  },
];

const CATEGORY_CONTEXT: Record<ResearchCategory, string> = {
  materials: "bathroom fixtures tile grout waterproofing sealant cost",
  plumbing: "plumbing code vent stack trap fixture sizing",
  code: "bathroom code building permit ventilation accessibility ADA",
  waterproofing: "waterproofing shower pan tile shower enclosure water damage",
  safety: "bathroom safety slip fall ventilation mold moisture",
  general: "bathroom remodel contractor installation",
};

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readCategory(value: unknown): ResearchCategory {
  const allowed: ResearchCategory[] = ["materials", "plumbing", "code", "waterproofing", "safety", "general"];
  return allowed.includes(value as ResearchCategory) ? (value as ResearchCategory) : "general";
}

function buildQuery(query: string, category: ResearchCategory, location?: string | null) {
  const locationText = location ? ` ${location}` : "";
  return `${query} ${CATEGORY_CONTEXT[category]}${locationText}`.replace(/\s+/g, " ").trim();
}

function buildFallback(query: string, category: ResearchCategory, location?: string | null): ResearchResponse {
  const scopedQuery = buildQuery(query, category, location);
  return {
    provider: "offline",
    query: scopedQuery,
    category,
    generatedAt: new Date().toISOString(),
    answer: "Internet research provider is not configured. SEMSE prepared the query and trusted sources.",
    results: TRUSTED_SOURCES,
    recommendations: [
      `Run live search for: ${scopedQuery}`,
      "Verify plumbing code adoption for your jurisdiction before finalizing layout.",
      "Check tile and waterproofing product compatibility before installation.",
    ],
    gates: [
      "Do not finalize plumbing layout without local code review.",
      "Confirm waterproofing method matches tile type and substrate.",
      "Verify fixture ADA compliance if required.",
    ],
    warnings: ["No live internet provider configured for this environment."],
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const query = readString(body.query);
    if (!query) {
      return NextResponse.json({ error: { message: "query is required" } }, { status: 400 });
    }

    const category = readCategory(body.category);
    const location = readString(body.location);
    const scopedQuery = buildQuery(query, category, location);

    return NextResponse.json({ data: buildFallback(query, category, location) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bathroom research failed";
    return NextResponse.json({ error: { message } }, { status: 500 });
  }
}
