export function normalizeRepoLookupTerm(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9/]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
