import { ForbiddenException } from "@nestjs/common";

export type ContributorActor = {
  tenantId: string;
  orgId: string;
  userId: string;
  roles: string[];
};

function isOpsAdmin(actor: ContributorActor): boolean {
  return actor.roles.includes("OPS_ADMIN");
}

// Ownership is by userId, not orgId — a contributor's mission acceptances,
// submissions, assets, appeals and rewards are personal, never shared with
// an org (spec §15: "un contribuidor nunca debe poder acceder al contenido
// privado de otro mediante cambio de ID").
export function assertOwnsResource(actor: ContributorActor, ownerUserId: string): void {
  if (isOpsAdmin(actor) || actor.userId === ownerUserId) {
    return;
  }
  throw new ForbiddenException({
    code: "CONTRIBUTOR_PROGRAM_FORBIDDEN",
    message: "actor does not have access to this contributor-program resource"
  });
}

export function assertIsOpsAdmin(actor: ContributorActor): void {
  if (isOpsAdmin(actor)) {
    return;
  }
  throw new ForbiddenException({
    code: "CONTRIBUTOR_PROGRAM_ADMIN_REQUIRED",
    message: "this action requires an OPS_ADMIN reviewer"
  });
}
