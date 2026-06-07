import type { WorkspaceMemoryQuery, WorkspaceMemoryRecord } from "./model.js";

export interface WorkspaceMemoryStore {
  query(input: WorkspaceMemoryQuery): Promise<WorkspaceMemoryRecord[]>;
  upsert(record: WorkspaceMemoryRecord): Promise<WorkspaceMemoryRecord>;
}
