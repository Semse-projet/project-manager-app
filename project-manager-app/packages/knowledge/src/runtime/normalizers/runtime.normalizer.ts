export function normalizeRuntimeLookupTerm(term: string): string {
  return term
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s/-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

