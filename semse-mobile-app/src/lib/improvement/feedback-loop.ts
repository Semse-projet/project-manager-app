export type FeedbackLoopRecord = {
  source: "user" | "operator" | "agent" | "system";
  topic: string;
  severity: "low" | "medium" | "high";
  summary: string;
};

export function normalizeFeedbackLoop(
  record: FeedbackLoopRecord,
): FeedbackLoopRecord {
  return {
    ...record,
    summary: record.summary.trim(),
  };
}
