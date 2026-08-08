export type WorkerEvidenceType = "photo" | "video" | "document";

export type WorkerEvidence = {
  id: string;
  jobId: string;
  jobTitle: string;
  type: WorkerEvidenceType;
  url: string;
  description: string;
  date: string;
  location?: string;
};
