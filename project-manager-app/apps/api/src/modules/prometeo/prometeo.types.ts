export type PrometeoChunkRecord = {
  id: string;
  documentId: string;
  chunkIndex: number;
  text: string;
  tokenCount: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
  score?: number;
};

export type PrometeoDocumentRecord = {
  id: string;
  tenantId: string;
  orgId: string;
  projectId?: string;
  title: string;
  sourceType: string;
  sourceRef?: string;
  status: string;
  chunkCount: number;
  uploadedById: string;
  errorMsg?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type PrometeoDocumentDetail = PrometeoDocumentRecord & {
  chunks: PrometeoChunkRecord[];
};

export type PrometeoSearchHit = PrometeoChunkRecord & {
  documentTitle: string;
  sourceType: string;
  projectId?: string;
  orgId: string;
  score: number;
};

export type PrometeoAskCitation = {
  documentId: string;
  title: string;
  chunkId: string;
  chunkIndex: number;
  score: number;
  snippet: string;
};

export type PrometeoAskResult = {
  answer: string;
  citations: PrometeoAskCitation[];
  fromLLM: boolean;
  provider?: string;
  model?: string;
};
