import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { type MilestoneRecord } from "../../common/domain-store.js";
import { milestonesMemoryStore } from "./milestones.memory-store.js";

export function createMilestoneMemory(input: {
  tenantId: string;
  projectId: string;
  title: string;
  amount: number;
  sequence: number;
}): MilestoneRecord {
  if (input.amount <= 0) {
    throw new BadRequestException("milestone amount must be greater than zero");
  }

  const duplicateSequence = milestonesMemoryStore.milestones.find(
    (entry) => entry.tenantId === input.tenantId && entry.projectId === input.projectId && entry.sequence === input.sequence
  );
  if (duplicateSequence) {
    throw new ConflictException(`milestone sequence '${input.sequence}' already exists`);
  }

  const milestone: MilestoneRecord = {
    id: `milestone_${Date.now()}`,
    tenantId: input.tenantId,
    projectId: input.projectId,
    title: input.title,
    amount: input.amount,
    sequence: input.sequence,
    status: "draft"
  };

  milestonesMemoryStore.milestones.push(milestone);
  return milestone;
}

export function listMilestonesByProjectMemory(input: {
  tenantId: string;
  projectId: string;
}): MilestoneRecord[] {
  return milestonesMemoryStore.milestones
    .filter((entry) => entry.tenantId === input.tenantId && entry.projectId === input.projectId)
    .sort((left, right) => left.sequence - right.sequence);
}

export function submitMilestoneMemory(input: { tenantId: string; milestoneId: string }): MilestoneRecord {
  const milestone = findMilestoneOrThrowMemory(input);
  if (milestone.status !== "draft" && milestone.status !== "rejected") {
    throw new ConflictException(`cannot submit milestone in status '${milestone.status}'`);
  }
  milestone.status = "submitted";
  return milestone;
}

export function approveMilestoneMemory(input: { tenantId: string; milestoneId: string }): MilestoneRecord {
  const milestone = findMilestoneOrThrowMemory(input);
  if (milestone.status !== "submitted") {
    throw new ConflictException(`cannot approve milestone in status '${milestone.status}'`);
  }
  milestone.status = "approved";
  return milestone;
}

export function rejectMilestoneMemory(input: {
  tenantId: string;
  milestoneId: string;
  reason: string;
}): MilestoneRecord {
  const milestone = findMilestoneOrThrowMemory(input);
  if (milestone.status === "paid") {
    throw new ConflictException("cannot reject milestone in paid status");
  }
  if (milestone.status !== "submitted" && milestone.status !== "approved") {
    throw new ConflictException(`cannot reject milestone in status '${milestone.status}'`);
  }
  milestone.status = "rejected";
  milestone.rejectionReason = input.reason;
  milestone.reviewDecision = "reject";
  return milestone;
}

function findMilestoneOrThrowMemory(input: { tenantId: string; milestoneId: string }): MilestoneRecord {
  const milestone = milestonesMemoryStore.milestones.find(
    (entry) => entry.tenantId === input.tenantId && entry.id === input.milestoneId
  );

  if (!milestone) {
    throw new NotFoundException(`Milestone '${input.milestoneId}' not found`);
  }

  return milestone;
}
