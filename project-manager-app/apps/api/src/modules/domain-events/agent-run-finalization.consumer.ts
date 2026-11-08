import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { DomainOutboxEvent, Prisma } from "@prisma/client";
import prismaClientPackage from "../../../../../node_modules/.prisma/client/index.js";
import { buildWorkspaceMemoryId } from "@semse/knowledge";
import { agentRunFinalizedV1EventSchema } from "@semse/schemas";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

const { Prisma: PrismaRuntime } = prismaClientPackage as typeof import("../../../../../node_modules/.prisma/client/index.js");
export const AGENT_RUN_EFFECTS_CONSUMER = "agent-run-effects.v1";
type Result = {
  eventId: string; consumer: typeof AGENT_RUN_EFFECTS_CONSUMER;
  status: "completed"; effect: "updated"; duplicate?: boolean;
};
type Receipt = { id: string; status: string; resultJson: unknown };

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}
function requiredText(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Invalid ${field} in agent finalization`);
  return value;
}
function approvalData(value: unknown, runId: string, correlationId: string, tenantId: string, orgId: string) {
  const a = record(value);
  if (a.runId !== runId || a.correlationId !== correlationId || a.status !== "pending") {
    throw new Error("Agent approval must belong to run and start pending");
  }
  if (typeof a.riskScore !== "number" || !Number.isFinite(a.riskScore) ||
      a.riskScore < 0 || a.riskScore > 1) {
    throw new Error("Invalid approval riskScore");
  }
  if (!Array.isArray(a.requiredApprovals) ||
      !a.requiredApprovals.every((v) => typeof v === "string")) {
    throw new Error("Invalid requiredApprovals");
  }
  const requestedAt = new Date(requiredText(a.requestedAt, "requestedAt"));
  if (Number.isNaN(requestedAt.getTime())) throw new Error("Invalid requestedAt");
  return {
    id: requiredText(a.id, "approval id"), tenantId, orgId, runId, correlationId,
    agentType: requiredText(a.agentType, "agentType"),
    title: requiredText(a.title, "title"),
    reason: requiredText(a.reason, "reason"), status: "PENDING" as const,
    riskLevel: requiredText(a.riskLevel, "riskLevel"),
    riskScore: new PrismaRuntime.Decimal(a.riskScore),
    policyDecision: requiredText(a.policyDecision, "policyDecision"),
    requiredApprovals: a.requiredApprovals as string[],
    contextSummary: typeof a.contextSummary === "string" ? a.contextSummary : null,
    requestedAt,
  };
}

/**
 * Post-commit completion effects are recoverable because the producer writes
 * the outbox event in the same transaction as the AgentRun CAS. This consumer
 * atomically applies ALL local DB effects plus one existing consumption receipt.
 * Queues and external agent actions are at-least-once, not exactly-once.
 */
@Injectable()
export class AgentRunFinalizationConsumer {
  constructor(private readonly prisma: PrismaService) {}

  async consume(stored: DomainOutboxEvent): Promise<Result> {
    const event = agentRunFinalizedV1EventSchema.parse({
      eventId: stored.eventId, eventType: stored.eventType,
      version: stored.version, envelopeVersion: stored.envelopeVersion,
      occurredAt: stored.occurredAt.toISOString(),
      recordedAt: stored.recordedAt.toISOString(),
      tenantId: stored.tenantId, orgId: stored.orgId,
      module: stored.module, entityType: stored.entityType,
      entityId: stored.entityId,
      actor: { type: stored.actorType, id: stored.actorId },
      correlationId: stored.correlationId,
      idempotencyKey: stored.idempotencyKey, schemaRef: stored.schemaRef,
      payload: stored.payloadJson,
    });
    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      await tx.$executeRaw(PrismaRuntime.sql`
        INSERT INTO "DomainEventConsumption" (
          "id","eventId","tenantId","consumerName","status",
          "attempts","maxAttempts","nextAttemptAt","createdAt","updatedAt"
        ) VALUES (
          ${randomUUID()}, ${event.eventId}::uuid, ${event.tenantId},
          ${AGENT_RUN_EFFECTS_CONSUMER}, 'PENDING'::"DomainConsumptionStatus",
          0, 5, ${now}, ${now}, ${now}
        ) ON CONFLICT ("eventId","consumerName") DO NOTHING
      `);
      const receipts = await tx.$queryRaw<Receipt[]>(PrismaRuntime.sql`
        SELECT "id","status","resultJson" FROM "DomainEventConsumption"
        WHERE "eventId"=${event.eventId}::uuid
          AND "consumerName"=${AGENT_RUN_EFFECTS_CONSUMER}
        FOR UPDATE
      `);
      const receipt = receipts[0];
      if (!receipt) throw new Error("No agent effects receipt");
      if (receipt.status === "COMPLETED") return { ...(receipt.resultJson as Result), duplicate: true };
      if (receipt.status === "DEAD_LETTER") throw new Error("Agent effects receipt dead-lettered");
      const run = await tx.agentRun.findFirst({where:{id:event.payload.runId,tenantId:event.tenantId}});
      if (!run || run.status !== event.payload.terminalStatus ||
          run.attempts !== event.payload.attempts || run.correlationId !== event.correlationId) {
        throw new Error("Agent finalization source changed before effects");
      }
      const input = record(run.inputJson), output = record(run.outputJson);
      const approvals = event.payload.terminalStatus === "COMPLETED" && Array.isArray(output.approvals)
        ? output.approvals.map(a => approvalData(a, run.id, run.correlationId, event.tenantId, event.orgId))
        : [];
      const ids = approvals.map(a => a.id);
      if (new Set(ids).size !== ids.length) throw new Error("Duplicate finalization approval IDs");
      if (ids.length) {
        const existing = await tx.agentApproval.findMany({
          where: { id: { in: ids } },
          select: { id: true, tenantId: true, runId: true },
        });
        if (existing.some(a => a.tenantId !== event.tenantId || a.runId !== run.id)) {
          throw new Error("Approval identifier belongs to another tenant/run");
        }
        await tx.agentApproval.createMany({data:approvals,skipDuplicates:true});
        for (const a of approvals) {
          await tx.auditLog.create({data:{
            tenantId:event.tenantId, actorUserId:event.actor.id,
            entityType:"AgentApproval",entityId:a.id,action:"agent.approval.create",
            afterJson:{
              runId:run.id,agentType:run.agentType,status:"pending",
              riskLevel:a.riskLevel,riskScore:Number(a.riskScore),
              eventId:event.eventId,requestId:event.payload.requestId,
            },occurredAt:now,
          }});
        }
      }
      await tx.auditLog.create({data:{
        tenantId:event.tenantId,actorUserId:event.actor.id,
        entityType:"AgentRun",entityId:run.id,
        action:event.payload.terminalStatus === "COMPLETED" ? "agent.run.complete" : "agent.run.fail",
        afterJson:{requestId:event.payload.requestId,eventId:event.eventId,
          ...(ids.length?{approvalsOpened:ids}:{}),},
        occurredAt:now,
      }});
      const operator = record(input.operatorContext);
      if (typeof operator.workspaceId === "string" && operator.workspaceId) {
        if (operator.tenantId !== event.tenantId || operator.orgId !== event.orgId) {
          throw new Error("Workspace memory scope mismatch");
        }
        const workspaceId=operator.workspaceId;
        const memoryId=buildWorkspaceMemoryId({
          workspaceId,kind:"run_summary",slug:run.id.replace(/[^a-zA-Z0-9_-]/g,"-"),
        });
        const old = await tx.workspaceMemoryEntry.findUnique({where:{id:memoryId},select:{tenantId:true}});
        if (old && old.tenantId !== event.tenantId) throw new Error("Workspace memory ID collides across tenants");
        const completed=event.payload.terminalStatus === "COMPLETED";
        const summary=completed
          ? (typeof output.summary==="string"?output.summary:`Agent run completed for '${run.agentType}'`)
          : `Agent run failed for '${run.agentType}': ${run.error ?? ""}`;
        await tx.workspaceMemoryEntry.upsert({
          where:{id:memoryId},
          create:{
            id:memoryId,tenantId:event.tenantId,orgId:event.orgId,
            createdBy:typeof operator.operatorId==="string"&&operator.operatorId
              ? operator.operatorId:event.actor.id,
            workspaceId,repoId:typeof operator.repoId==="string"?operator.repoId:null,
            runId:run.id,taskId:typeof operator.taskId==="string"?operator.taskId:null,
            kind:"run_summary",
            scope:typeof operator.taskId==="string"?"task":typeof operator.repoId==="string"?"repo":"workspace",
            title:`Agent run ${completed?"completed":"failed"}: ${run.agentType}`,
            summary,
            body:[
              `Agent: ${run.agentType}`,`Trigger: ${run.triggerType}`,
              typeof output.actionType==="string"?`Action: ${output.actionType}`:null,
              typeof output.recommendation==="string"?`Recommendation: ${output.recommendation}`:null,
              run.error?`Error: ${run.error}`:null,
            ].filter(Boolean).join("\n"),
            tags:["agent-runtime","run-summary",run.agentType,completed?"completed":"failed"],
            sourceRef:run.correlationId,
          },
          update:{}, // Never undo an operator's correction/invalidation.
        });
      }
      if (run.triggerType==="event" && typeof input.delegationId==="string") {
        const n=await tx.agentDelegation.updateMany({
          where:{id:input.delegationId,tenantId:event.tenantId},
          data:{
            status:event.payload.terminalStatus==="COMPLETED"?"completed":"failed",
            ...(event.payload.terminalStatus==="COMPLETED"
              ? {resultJson:run.outputJson === null ? PrismaRuntime.JsonNull : run.outputJson as Prisma.InputJsonValue}
              : {error:run.error ?? "Agent failed"}),
          },
        });
        if (n.count !== 1) throw new Error("Delegation missing from event tenant");
      }
      const result:Result={eventId:event.eventId,consumer:AGENT_RUN_EFFECTS_CONSUMER,
        status:"completed",effect:"updated"};
      await tx.domainEventConsumption.update({
        where:{id:receipt.id},
        data:{status:"COMPLETED",attempts:{increment:1},startedAt:now,
          completedAt:new Date(),resultJson:result as Prisma.InputJsonValue,
          lastError:null,nextAttemptAt:now},
      });
      return result;
    });
  }
}
