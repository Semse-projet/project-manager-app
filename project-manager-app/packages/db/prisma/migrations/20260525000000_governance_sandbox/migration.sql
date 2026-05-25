-- Governance Sandbox — P4 Prometeo DAO
-- Reputation-weighted proposals and quadratic voting

CREATE TABLE "GovernanceProposal" (
    "id"                    TEXT NOT NULL,
    "tenantId"              TEXT NOT NULL,
    "title"                 TEXT NOT NULL,
    "description"           TEXT NOT NULL,
    "category"              TEXT NOT NULL DEFAULT 'general',
    "status"                TEXT NOT NULL DEFAULT 'open',
    "authorId"              TEXT NOT NULL,
    "authorReputationScore" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "mcaAdvice"             TEXT,
    "mcaRisk"               TEXT NOT NULL DEFAULT 'low',
    "closesAt"              TIMESTAMP(3) NOT NULL,
    "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"             TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GovernanceProposal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GovernanceVote" (
    "id"                   TEXT NOT NULL,
    "tenantId"             TEXT NOT NULL,
    "proposalId"           TEXT NOT NULL,
    "voterId"              TEXT NOT NULL,
    "choice"               TEXT NOT NULL,
    "voterReputationScore" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "units"                INTEGER NOT NULL DEFAULT 1,
    "reason"               TEXT,
    "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GovernanceVote_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "GovernanceProposal_tenantId_status_idx"   ON "GovernanceProposal"("tenantId", "status");
CREATE INDEX "GovernanceProposal_tenantId_closesAt_idx" ON "GovernanceProposal"("tenantId", "closesAt");
CREATE INDEX "GovernanceProposal_authorId_idx"          ON "GovernanceProposal"("authorId");

CREATE UNIQUE INDEX "GovernanceVote_proposalId_voterId_key" ON "GovernanceVote"("proposalId", "voterId");
CREATE INDEX "GovernanceVote_tenantId_proposalId_idx"        ON "GovernanceVote"("tenantId", "proposalId");
CREATE INDEX "GovernanceVote_voterId_idx"                    ON "GovernanceVote"("voterId");

-- FK: GovernanceVote → GovernanceProposal
ALTER TABLE "GovernanceVote"
    ADD CONSTRAINT "GovernanceVote_proposalId_fkey"
    FOREIGN KEY ("proposalId")
    REFERENCES "GovernanceProposal"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;


-- Governance Credit Ledger — P5 participation tokens
CREATE TABLE "GovernanceCreditEvent" (
    "id"        TEXT NOT NULL,
    "tenantId"  TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "credits"   DECIMAL(8,2) NOT NULL,
    "context"   TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GovernanceCreditEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GovernanceCreditEvent_tenantId_userId_idx" ON "GovernanceCreditEvent"("tenantId", "userId");
CREATE INDEX "GovernanceCreditEvent_userId_createdAt_idx" ON "GovernanceCreditEvent"("userId", "createdAt");
