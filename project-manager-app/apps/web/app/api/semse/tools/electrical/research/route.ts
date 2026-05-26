import { type NextRequest, NextResponse } from "next/server";

type ResearchCategory = "materials" | "code" | "permit" | "pricing" | "innovation" | "safety" | "general";

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

const TRUSTED_ELECTRICAL_SOURCES: ResearchResult[] = [
  {
    title: "NFPA 70, National Electrical Code",
    url: "https://www.nfpa.org/codes-and-standards/nfpa-70-standard-development/70",
    snippet: "Official NFPA page for the NEC. Use for code edition context and access paths, then confirm local adoption.",
    source: "NFPA",
  },
  {
    title: "OSHA Electrical Safety and Standards",
    url: "https://www.osha.gov/electrical",
    snippet: "Federal workplace electrical safety references for construction and general industry conditions.",
    source: "OSHA",
  },
  {
    title: "ENERGY STAR Electric Vehicle Chargers",
    url: "https://www.energystar.gov/products/ev_chargers",
    snippet: "Reference for EV charger efficiency and product considerations when estimating charger installs.",
    source: "ENERGY STAR",
  },
  {
    title: "UL Product iQ",
    url: "https://productiq.ulprospector.com/",
    snippet: "UL product certification lookup. Use when material compatibility, listing, or labeling is a risk gate.",
    source: "UL",
  },
];

const CATEGORY_CONTEXT: Record<ResearchCategory, string> = {
  materials: "electrical material pricing availability compatibility supplier catalog",
  code: "NEC NFPA 70 electrical code requirements inspection",
  permit: "electrical permit inspection local authority having jurisdiction",
  pricing: "electrical contractor pricing labor material estimate 2026",
  innovation: "electrical contractor innovation smart panel EV charger load management prefabrication",
  safety: "electrical safety OSHA NFPA lockout tagout GFCI AFCI",
  general: "electrical construction estimating contractor operations",
};

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readCategory(value: unknown): ResearchCategory {
  const allowed: ResearchCategory[] = ["materials", "code", "permit", "pricing", "innovation", "safety", "general"];
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
    results: TRUSTED_ELECTRICAL_SOURCES,
    recommendations: [
      `Run live search for: ${scopedQuery}`,
      "Prefer official code, manufacturer, AHJ, OSHA, UL, utility, and supplier sources over blogs or AI-generated summaries.",
      "Treat pricing as provisional until material availability, brand compatibility, and local labor rate are confirmed.",
    ],
    gates: [
      "Do not change an estimate from web results without source URL, date checked, and confidence note.",
      "For code or permit questions, verify local NEC adoption and AHJ requirements before marking ready.",
      "For safety-critical findings, require licensed electrician review before BuildOps conversion or payment release.",
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
      "Review top sources and pin the strongest citation to the estimate notes.",
      "Use supplier/manufacturer pages for material substitutions and AHJ/code pages for permit gates.",
      "If a result changes cost, create a material price uncertainty note or change-order candidate.",
    ],
    gates: [
      "Verify local code adoption before applying NEC interpretation.",
      "Confirm brand compatibility for breakers, panels, smart devices, and EV chargers.",
      "Mark safety-critical findings as requiring licensed review.",
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
      "Use the synthesized answer only as a starting point; decisions need source review.",
      "Attach source URLs to estimate assumptions when they affect price, schedule, or risk.",
      "Escalate code, permit, or safety findings to a licensed reviewer before payment readiness.",
    ],
    gates: [
      "Require source-backed confirmation for NEC, AHJ, utility, or manufacturer constraints.",
      "Reject anonymous or stale pricing evidence for high-value material lines.",
      "Create a change-order candidate if live research contradicts the saved scope.",
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
    const message = error instanceof Error ? error.message : "Electrical research failed";
    return NextResponse.json({ error: { message } }, { status: 500 });
  }
}
