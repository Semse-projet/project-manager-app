// Builds the derived, in-memory skill registry from raw discovery entries.
//
// A skill with an explicit `routing:` frontmatter block uses it as-is.
// A skill without one (every real SEMSE skill today, per the Skill Router
// kit's live audit) gets a *legacy-inferred* routing object derived purely
// from its `name`/`description` — never hardcoded per skill id — plus a
// MISSING_ROUTING_METADATA warning. This is what "Legacy compatibility"
// (Master Router Contract §7) requires: usable, warned, not blocking.

const GOVERNANCE_HINTS = [
  /\bgovernance\b/i,
  /\bapproval gate\b/i,
  /\bmaster governance\b/i,
  /\baudit trail\b/i,
  /skill maestro/i,
];
const EXECUTION_HINTS = [
  /execution discipline/i,
  /zoom \+ loop/i,
  /\bzoom mode\b/i,
  /\bloop mode\b/i,
  /end-to-end completion/i,
];
const SUPPORT_HINTS = [
  /\btesting\b/i,
  /session report/i,
  /product architect|experience director|creative director|ux auditor/i,
  /local stack/i,
];

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "for", "with", "when", "use", "used", "using", "this",
  "skill", "skills", "semse", "semseproject", "project", "any", "all", "work", "works",
  "that", "touches", "its", "own", "also", "even", "only", "not", "from", "into", "are",
  "is", "be", "of", "to", "in", "on", "at", "by", "as", "it", "if", "so", "no", "does",
  "do", "you", "your", "before", "after", "without", "than", "then", "same", "each",
  "real", "already", "over", "under", "one", "two", "three", "four", "five", "example",
  "means", "meant", "such", "will", "can", "may", "must", "should", "would", "them",
  "their", "there", "here", "what", "which", "who", "how", "why", "trigger", "even",
  // Generic scope/process vocabulary that overlaps with this router's own
  // classification signals (see classify.mjs). These words describe *how
  // broad* a task is, not *what domain* a skill owns, so letting them count
  // as inferred domain triggers causes false matches purely because a
  // skill's own description happens to use the same shape-of-work language
  // (e.g. an observability skill mentioning "end-to-end" tracing has
  // nothing to do with a task that is merely broad in scope).
  "api", "endpoints", "together", "anything", "locally", "running", "run",
  "end-to-end", "cross-domain", "multi-layer", "single-file", "single-layer",
]);

function inferSignificantWords(text) {
  const words = (text.toLowerCase().match(/[a-z][a-z0-9-]{3,}/g) || []);
  const uniqueInOrder = [];
  const seen = new Set();
  for (const w of words) {
    if (STOPWORDS.has(w) || seen.has(w)) continue;
    seen.add(w);
    uniqueInOrder.push(w);
  }
  return uniqueInOrder;
}

function inferCategory(description) {
  const text = description ?? "";
  if (GOVERNANCE_HINTS.some((r) => r.test(text))) return "governance";
  if (EXECUTION_HINTS.some((r) => r.test(text))) return "execution";
  if (SUPPORT_HINTS.some((r) => r.test(text))) return "support";
  return "domain";
}

function inferRouting(entry) {
  const description = entry.description ?? entry.name ?? "";
  const significantWords = inferSignificantWords(description);
  // Refinement 2 from the live audit ("specificity beats breadth"): a
  // longer/broader description covers more ground and should NOT out-score
  // a short, narrow one purely because it also happens to contain more
  // matching words. So specificity is inversely proportional to how many
  // distinct significant words the description carries, not proportional
  // to it.
  const specificity = Math.max(10, Math.min(90, 100 - significantWords.length * 2));

  return {
    version: 0,
    category: inferCategory(description),
    scope: [],
    triggers: significantWords.slice(0, 25),
    excludes: [],
    phases: [],
    precedence: { subordinate_to: [], may_constrain: [] },
    specificity,
    status: "active",
    supersedes: [],
    superseded_by: [],
    notes: "inferred from name/description; no explicit routing: metadata present",
    inferred: true,
  };
}

export function buildRegistry(discovery) {
  const skills = [];
  const warnings = [...discovery.warnings];

  for (const entry of discovery.entries) {
    for (const w of entry.parseWarnings) warnings.push(w);

    const hasRoutingMetadata = Boolean(entry.routing);
    let routing;
    if (hasRoutingMetadata) {
      routing = { ...entry.routing, inferred: false };
    } else {
      warnings.push({
        code: "MISSING_ROUTING_METADATA",
        message: `${entry.id}: no optional routing: metadata; using legacy inference from description`,
      });
      routing = inferRouting(entry);
    }

    skills.push({
      id: entry.id,
      root: entry.root,
      path: entry.path,
      name: entry.name ?? entry.id,
      description: entry.description ?? "",
      hasRoutingMetadata,
      routing,
    });
  }

  return { skills, warnings, duplicates: discovery.duplicates };
}
