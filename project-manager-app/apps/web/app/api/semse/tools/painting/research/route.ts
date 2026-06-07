import { type NextRequest, NextResponse } from "next/server";

type ResearchCategory = "materials" | "technique" | "prep" | "finish" | "safety" | "general";

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

const TRUSTED_PAINTING_SOURCES: ResearchResult[] = [
  {
    title: "EPA Lead Paint RRP Rule & Guidance",
    url: "https://www.epa.gov/lead/renovation-repair-and-painting-program",
    snippet: "Federal RRP requirements for lead-safe practices in pre-1978 homes.",
    source: "EPA",
  },
  {
    title: "Paint Quality Institute (PQI) Best Practices",
    url: "https://www.paintquality.org/",
    snippet: "Professional painter standards, surface prep, and quality benchmarks.",
    source: "PQI",
  },
  {
    title: "Sherwin-Williams Technical Documentation",
    url: "https://www.sherwin-williams.com/homeowners/",
    snippet: "Paint product specs, primer selection, and application guides.",
    source: "Sherwin-Williams",
  },
  {
    title: "OSHA Painter Safety Standards",
    url: "https://www.osha.gov/painters",
    snippet: "Workplace safety for painting contractors including ladder, chemical, and fall protection.",
    source: "OSHA",
  },
];

const CATEGORY_CONTEXT: Record<ResearchCategory, string> = {
  materials: "paint primer quality brands coverage cost material selection",
  technique: "painting technique application brush roller spray interior exterior",
  prep: "surface preparation sanding priming drywall patching cleaning",
  finish: "paint finish sheen gloss eggshell matte satin durability",
  safety: "painter safety OSHA lead paint RRP chemical ventilation PPE",
  general: "residential painting contractor estimate labor timing",
};

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readCategory(value: unknown): ResearchCategory {
  const allowed: ResearchCategory[] = ["materials", "technique", "prep", "finish", "safety", "general"];
  return allowed.includes(value as ResearchCategory) ? (value as ResearchCategory) : "general";
}

function readMaxResults(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return 6;
  return Math.max(3, Math.min(10, Math.round(parsed)));
}

function domainFromUrl(url: string): string | undefined {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
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
    answer:
      "Internet research provider is not configured. SEMSE prepared the query, trusted source targets, and risk gates so the tool can run live search once BRAVE_SEARCH_API_KEY or TAVILY_API_KEY is set.",
    results: TRUSTED_PAINTING_SOURCES,
    recommendations: [
      `Run live search for: ${scopedQuery}`,
      "Prefer manufacturer specs, EPA/OSHA guidance, and professional trade organization standards.",
      "Verify product compatibility, VOC compliance, and warranty terms for material selections.",
    ],
    gates: [
      "Do not specify a material without confirming coverage rate and actual cost.",
      "For pre-1978 homes, verify EPA RRP compliance before work starts.",
      "Confirm surface prep method matches paint type and substrate.",
    ],
    warnings: ["No live internet provider configured for this environment."],
  };
}

async function searchBrave(scopedQuery: string, category: ResearchCategory, maxResults: number): Promise<ResearchResponse> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) throw new Error("BRAVE_SEARCH_API_KEY not configured");

  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", scopedQuery);
  url.searchParams.set("count", String(maxResults));
  url.searchParams.set("safesearch", "moderate");

  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "X-Subscription-Token": apiKey,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Brave search failed with ${response.status}`);
  }

  const payload = (await response.json()) as {
    web?: {
      results?: Array<{
        title?: string;
        url?: string;
        description?: string;
        profile?: { name?: string };
      }>;
    };
  };

  const results = (payload.web?.results ?? [])
    .filter((item) => item.title && item.url)
    .slice(0, maxResults)
    .map((item) => ({
      title: item.title ?? "Untitled result",
      url: item.url ?? "",
      snippet: item.description ?? "No snippet returned.",
      source: item.profile?.name ?? domainFromUrl(item.url ?? ""),
    }));

  return {
    provider: "brave",
    query: scopedQuery,
    category,
    generatedAt: new Date().toISOString(),
    results,
    recommendations: [
      "Pin sources for material specifications and prep method selections.",
      "Use manufacturer TDS/SDS sheets for VOC, coverage, and application requirements.",
      "Reference EPA RRP, OSHA, and PQI standards for safety and quality gates.",
    ],
    gates: [
      "Require SDS review for chemical-hazard and PPE requirements.",
      "Verify RRP compliance for any pre-1978 home (EPA requirement).",
      "Cross-check coverage rates and dry time for scheduling accuracy.",
    ],
    warnings: results.length === 0 ? ["Live search returned no results. Broaden the query or try another provider."] : [],
  };
}

async function searchTavily(scopedQuery: string, category: ResearchCategory, maxResults: number): Promise<ResearchResponse> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) throw new Error("TAVILY_API_KEY not configured");

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      api_key: apiKey,
      query: scopedQuery,
      max_results: maxResults,
      search_depth: "advanced",
      include_answer: true,
      include_raw_content: false,
      include_images: false,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Tavily search failed with ${response.status}`);
  }

  const payload = (await response.json()) as {
    answer?: string;
    results?: Array<{ title?: string; url?: string; content?: string; score?: number }>;
  };

  const results = (payload.results ?? [])
    .filter((item) => item.title && item.url)
    .slice(0, maxResults)
    .map((item) => ({
      title: item.title ?? "Untitled result",
      url: item.url ?? "",
      snippet: item.content ?? "No snippet returned.",
      source: domainFromUrl(item.url ?? ""),
    }));

  return {
    provider: "tavily",
    query: scopedQuery,
    category,
    generatedAt: new Date().toISOString(),
    answer: payload.answer,
    results,
    recommendations: [
      "Use synthesized answer as a guide; always verify with source documentation.",
      "Attach manufacturer product specs for material selections and dry time.",
      "Document RRP compliance checks and surface prep method in job notes.",
    ],
    gates: [
      "Require RRP certification for pre-1978 homes (EPA requirement).",
      "Confirm paint/primer compatibility before application.",
      "Verify substrate compatibility and prep method with manufacturer guidance.",
    ],
    warnings: results.length === 0 ? ["Live search returned no results. Broaden the query or try another provider."] : [],
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
    const maxResults = readMaxResults(body.maxResults);
    const scopedQuery = buildQuery(query, category, location);

    if (process.env.BRAVE_SEARCH_API_KEY) {
      const data = await searchBrave(scopedQuery, category, maxResults);
      return NextResponse.json({ data });
    }

    if (process.env.TAVILY_API_KEY) {
      const data = await searchTavily(scopedQuery, category, maxResults);
      return NextResponse.json({ data });
    }

    return NextResponse.json({ data: buildFallback(query, category, location) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Painting research failed";
    return NextResponse.json({ error: { message } }, { status: 500 });
  }
}
