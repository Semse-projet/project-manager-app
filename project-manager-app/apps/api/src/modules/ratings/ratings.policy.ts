export type RatingActor = {
  tenantId: string;
  orgId: string;
  userId: string;
  roles: string[];
};

export type RatingAccessRecord = {
  fromUserId: string;
  toUserId: string;
};

export function isOpsAdmin(actor: RatingActor): boolean {
  return actor.roles.includes("OPS_ADMIN");
}

export function canCreateRating(actor: RatingActor): boolean {
  return actor.roles.includes("CLIENT") || actor.roles.includes("PRO") || isOpsAdmin(actor);
}

export function canReadRating(actor: RatingActor, rating: RatingAccessRecord): boolean {
  return isOpsAdmin(actor) || actor.userId === rating.fromUserId || actor.userId === rating.toUserId;
}

export function canReadRatingSummary(actor: RatingActor, targetUserId: string): boolean {
  return isOpsAdmin(actor) || actor.userId === targetUserId;
}
