CREATE INDEX IF NOT EXISTS "WorkspaceMemoryEntry_fts_idx"
ON "WorkspaceMemoryEntry"
USING GIN (
  to_tsvector('spanish',
    coalesce(title,'') || ' ' || coalesce(summary,'') || ' ' || coalesce(body,'')
  )
);
