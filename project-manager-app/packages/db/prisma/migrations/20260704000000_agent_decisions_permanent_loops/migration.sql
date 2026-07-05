-- SPEC-AUT-001 — Permanent Loops v1 (ADR-021 §4.4)
-- AgentDecision: memoria episódica de decisiones de loops/agentes.
-- PermanentLoopState: estado operativo por loop (pause/resume + métricas OMEGA).

-- CreateTable
CREATE TABLE "AgentDecision" (
    "id" TEXT NOT NULL,
    "loopId" TEXT,
    "runId" TEXT,
    "agentType" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'finding',
    "decision" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "outcome" TEXT,
    "confidence" DOUBLE PRECISION,
    "evidence" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermanentLoopState" (
    "id" TEXT NOT NULL,
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "pausedAt" TIMESTAMP(3),
    "pausedBy" TEXT,
    "lastCycleAt" TIMESTAMP(3),
    "lastCycleStatus" TEXT,
    "cyclesCompleted" INTEGER NOT NULL DEFAULT 0,
    "cyclesSkipped" INTEGER NOT NULL DEFAULT 0,
    "findingsRecorded" INTEGER NOT NULL DEFAULT 0,
    "proposalsOpened" INTEGER NOT NULL DEFAULT 0,
    "tokensConsumed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PermanentLoopState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentDecision_loopId_target_idx" ON "AgentDecision"("loopId", "target");

-- CreateIndex
CREATE INDEX "AgentDecision_agentType_createdAt_idx" ON "AgentDecision"("agentType", "createdAt");

-- CreateIndex
CREATE INDEX "AgentDecision_decision_createdAt_idx" ON "AgentDecision"("decision", "createdAt");
