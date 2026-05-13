-- Limpiar duplicados en Milestone (mantener el más antiguo)
DELETE FROM "Milestone" m1
WHERE EXISTS (
  SELECT 1 FROM "Milestone" m2
  WHERE m1."projectId" = m2."projectId"
    AND m1."sequence" = m2."sequence"
    AND m1."deletedAt" IS NULL
    AND m2."deletedAt" IS NULL
    AND m1.id > m2.id
);

-- Limpiar duplicados en BuildOpsProject
DELETE FROM "BuildOpsProject" b1
WHERE EXISTS (
  SELECT 1 FROM "BuildOpsProject" b2
  WHERE b1."jobId" = b2."jobId"
    AND b1.id > b2.id
);

-- Limpiar duplicados en BuildOpsTask
DELETE FROM "BuildOpsTask" t1
WHERE EXISTS (
  SELECT 1 FROM "BuildOpsTask" t2
  WHERE t1."projectId" = t2."projectId"
    AND t1."templateKey" = t2."templateKey"
    AND t1.id > t2.id
);

-- Limpiar duplicados en Evidence
DELETE FROM "Evidence" e1
WHERE EXISTS (
  SELECT 1 FROM "Evidence" e2
  WHERE e1."projectId" = e2."projectId"
    AND e1."promotedFromBuildOpsProjectId" = e2."promotedFromBuildOpsProjectId"
    AND e1."bucketKey" = e2."bucketKey"
    AND e1.id > e2.id
);

-- Limpiar duplicados en JobTask
DELETE FROM "JobTask" jt1
WHERE EXISTS (
  SELECT 1 FROM "JobTask" jt2
  WHERE jt1."jobId" = jt2."jobId"
    AND jt1."promotedFromBuildOpsTaskId" = jt2."promotedFromBuildOpsTaskId"
    AND jt1.id > jt2.id
);

-- Limpiar duplicados en Project
DELETE FROM "Project" p1
WHERE EXISTS (
  SELECT 1 FROM "Project" p2
  WHERE p1."promotedFromBuildOpsProjectId" = p2."promotedFromBuildOpsProjectId"
    AND p1."promotedFromBuildOpsProjectId" IS NOT NULL
    AND p1.id > p2.id
);
