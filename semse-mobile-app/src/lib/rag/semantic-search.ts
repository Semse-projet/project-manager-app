export type SemanticSearchRequest = {
  query: string;
  domain?: string;
  limit?: number;
};

export type SemanticSearchResult = {
  id: string;
  title: string;
  snippet: string;
  score: number;
  citation?: string;
};

export async function semanticSearch(
  _request: SemanticSearchRequest,
): Promise<SemanticSearchResult[]> {
  return [];
}
