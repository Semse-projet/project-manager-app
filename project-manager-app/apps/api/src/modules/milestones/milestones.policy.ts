import { ConflictException, ForbiddenException } from "@nestjs/common";
import { hasScopeAccess, isOpsAdmin, sameOrg, scopeFromOwnership } from "../../common/resource-scope.js";
import { selfApprovalAllowedInSandbox, type EvidenceRevalidationMode } from "./evidence-readiness.js";

export type MilestoneActor = {
  tenantId: string;
  orgId: string;
  userId: string;
  roles: string[];
};

export type MilestoneOwnership = {
  clientOrgId: string;
  assignedProOrgId: string;
};

export type MilestoneLifecycleSnapshot = {
  milestoneId: string;
  currentStatus: "draft" | "awaiting_review" | "submitted" | "approved" | "rejected" | "paid";
  ownership: MilestoneOwnership;
  evidenceCount: number;
  /**
   * C18: hay un RELEASE de escrow activo (PENDING en vuelo o SUCCEEDED) para este
   * hito. Mientras exista, el hito no puede rechazarse ni devolverse a cambios:
   * el dinero ya esta en movimiento o se movio.
   */
  hasActiveRelease?: boolean;
  /** C18: motivos por los que la evidencia REQUERIDA no esta validada (vacio = validada). */
  evidenceBlockers?: string[];
};

function access(actor: MilestoneActor, ownership: MilestoneOwnership, relation: "read" | "client" | "pro"): boolean {
  return hasScopeAccess(actor, scopeFromOwnership(actor, ownership), relation);
}

export function assertMilestoneReadable(actor: MilestoneActor, ownership: MilestoneOwnership): void {
  if (access(actor, ownership, "read")) {
    return;
  }

  throw new ForbiddenException("actor does not have access to this milestone");
}

export function assertMilestoneCreatable(actor: MilestoneActor, ownership: MilestoneOwnership): void {
  if (access(actor, ownership, "client")) {
    return;
  }

  throw new ForbiddenException("actor cannot create milestones for this project");
}

export function assertMilestoneSubmittable(actor: MilestoneActor, snapshot: MilestoneLifecycleSnapshot): void {
  if (!access(actor, snapshot.ownership, "pro")) {
    throw new ForbiddenException("actor cannot submit this milestone");
  }

  if (
    snapshot.currentStatus !== "draft" &&
    snapshot.currentStatus !== "rejected" &&
    snapshot.currentStatus !== "awaiting_review"
  ) {
    throw new ConflictException(`cannot submit milestone in status '${snapshot.currentStatus}'`);
  }

  if (snapshot.evidenceCount <= 0) {
    throw new ConflictException("milestone cannot be submitted without evidence");
  }
}

export function assertMilestoneApprovable(
  actor: MilestoneActor,
  snapshot: MilestoneLifecycleSnapshot,
  options: { evidenceMode?: EvidenceRevalidationMode; env?: NodeJS.ProcessEnv } = {},
): void {
  if (!access(actor, snapshot.ownership, "client")) {
    throw new ForbiddenException("actor cannot approve this milestone");
  }

  // C18: el mismo org no puede entregar y aprobar su propio hito (conflicto de interes).
  // OPS_ADMIN decide por encima; en no-produccion, el flag de sandbox lo permite para demos.
  if (
    !isOpsAdmin(actor) &&
    sameOrg(snapshot.ownership.clientOrgId, snapshot.ownership.assignedProOrgId) &&
    !selfApprovalAllowedInSandbox(options.env)
  ) {
    throw new ForbiddenException(
      "self-approval is not allowed: the client and the assigned professional are the same organization",
    );
  }

  if (snapshot.currentStatus !== "submitted") {
    throw new ConflictException(`cannot approve milestone in status '${snapshot.currentStatus}'`);
  }

  // C18: revalidar la evidencia REQUERIDA en el momento de aprobar (no solo al entregar).
  if ((options.evidenceMode ?? "enforce") === "enforce" && snapshot.evidenceBlockers && snapshot.evidenceBlockers.length > 0) {
    throw new ConflictException({
      message: "cannot approve milestone: required evidence is not validated",
      blockers: snapshot.evidenceBlockers,
    });
  }
}

export function assertMilestoneRejectable(actor: MilestoneActor, snapshot: MilestoneLifecycleSnapshot): void {
  if (!access(actor, snapshot.ownership, "client")) {
    throw new ForbiddenException("actor cannot reject this milestone");
  }

  if (snapshot.currentStatus === "paid") {
    throw new ConflictException("cannot reject milestone in paid status");
  }

  if (snapshot.hasActiveRelease) {
    throw new ConflictException("cannot reject milestone while an escrow release is in progress or completed");
  }

  if (snapshot.currentStatus !== "submitted" && snapshot.currentStatus !== "approved") {
    throw new ConflictException(`cannot reject milestone in status '${snapshot.currentStatus}'`);
  }
}
