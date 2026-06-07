ALTER TABLE "Bid"
  ADD COLUMN IF NOT EXISTS "professionalUserId" TEXT;

INSERT INTO "Role" ("id", "key", "name")
SELECT 'role_professional_bridge', 'PRO', 'Professional'
WHERE NOT EXISTS (
  SELECT 1 FROM "Role" WHERE "key" = 'PRO'
);

WITH missing_bid_orgs AS (
  SELECT DISTINCT
    b."proOrgId" AS org_id,
    o."tenantId" AS tenant_id
  FROM "Bid" b
  JOIN "Org" o ON o."id" = b."proOrgId"
  LEFT JOIN "Membership" m ON m."orgId" = b."proOrgId"
  LEFT JOIN "Role" r ON r."id" = m."roleId" AND r."key" = 'PRO'
  WHERE r."id" IS NULL
),
bridge_users AS (
  SELECT
    ('usr_bridge_' || org_id) AS user_id,
    ('usr_bridge_' || org_id || '@semse.local') AS email,
    org_id
  FROM missing_bid_orgs
)
INSERT INTO "User" ("id", "email", "status", "updatedAt")
SELECT user_id, email, 'active', CURRENT_TIMESTAMP
FROM bridge_users
ON CONFLICT ("email") DO NOTHING;

WITH missing_bid_orgs AS (
  SELECT DISTINCT
    b."proOrgId" AS org_id
  FROM "Bid" b
  LEFT JOIN "Membership" m ON m."orgId" = b."proOrgId"
  LEFT JOIN "Role" r ON r."id" = m."roleId" AND r."key" = 'PRO'
  WHERE r."id" IS NULL
)
INSERT INTO "Membership" ("userId", "orgId", "roleId", "createdAt")
SELECT
  'usr_bridge_' || mbo.org_id,
  mbo.org_id,
  r."id",
  CURRENT_TIMESTAMP
FROM missing_bid_orgs mbo
JOIN "Role" r ON r."key" = 'PRO'
LEFT JOIN "Membership" m
  ON m."userId" = 'usr_bridge_' || mbo.org_id
 AND m."orgId" = mbo.org_id
 AND m."roleId" = r."id"
WHERE m."userId" IS NULL;

UPDATE "Bid"
SET "professionalUserId" = COALESCE("professionalUserId", (
  SELECT m."userId"
  FROM "Membership" m
  JOIN "Org" o ON o."id" = m."orgId"
  JOIN "Role" r ON r."id" = m."roleId"
  WHERE m."orgId" = "Bid"."proOrgId"
    AND o."tenantId" = (
      SELECT j."tenantId"
      FROM "Job" j
      WHERE j."id" = "Bid"."jobId"
    )
    AND r."key" = 'PRO'
  ORDER BY m."createdAt" ASC
  LIMIT 1
));

ALTER TABLE "Bid"
  ALTER COLUMN "professionalUserId" SET NOT NULL;

DO $$
BEGIN
  ALTER TABLE "Bid"
    ADD CONSTRAINT "Bid_professionalUserId_fkey"
    FOREIGN KEY ("professionalUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "Bid_professionalUserId_status_idx" ON "Bid"("professionalUserId", "status");
