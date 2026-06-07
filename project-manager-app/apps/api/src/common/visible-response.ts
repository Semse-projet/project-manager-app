type RecordLike = Record<string, unknown>;

const jobStatusVisibleMap: Record<string, string> = {
  draft: "DRAFT",
  posted: "POSTED",
  published: "POSTED",
  reserved: "RESERVED",
  accepted: "ACCEPTED",
  in_progress: "IN_PROGRESS",
  review: "REVIEW",
  dispute: "DISPUTE",
  completed: "COMPLETED",
  awarded: "COMPLETED",
  cancelled: "CANCELLED"
};

const reservationStatusVisibleMap: Record<string, string> = {
  active: "ACTIVE",
  expired: "EXPIRED",
  accepted: "ACCEPTED",
  released: "RELEASED"
};

const milestoneStatusVisibleMap: Record<string, string> = {
  draft: "DRAFT",
  awaiting_review: "AWAITING_REVIEW",
  submitted: "SUBMITTED",
  approved: "APPROVED",
  rejected: "REJECTED",
  paid: "PAID"
};

const disputeStatusVisibleMap: Record<string, string> = {
  open: "OPEN",
  assigned: "ASSIGNED",
  resolved: "RESOLVED"
};

const escrowActionVisibleMap: Record<string, string> = {
  deposit: "FUND",
  release: "RELEASE",
  holdback: "HOLDBACK",
  fee: "FEE",
  refund: "REFUND"
};

const paymentStatusVisibleMap: Record<string, string> = {
  pending: "PENDING",
  succeeded: "SUCCEEDED",
  failed: "FAILED"
};

function withVisibleStatus<T extends RecordLike>(entity: T, map: Record<string, string>): T {
  const rawStatus = typeof entity.status === "string" ? entity.status : undefined;
  if (!rawStatus) {
    return entity;
  }

  return {
    ...entity,
    status: map[rawStatus] ?? rawStatus.toUpperCase(),
    statusRaw: rawStatus
  } as T;
}

export function toVisibleJob<T extends RecordLike>(job: T): T {
  return withVisibleStatus(job, jobStatusVisibleMap);
}

export function toVisibleReservation<T extends RecordLike>(reservation: T): T {
  return withVisibleStatus(reservation, reservationStatusVisibleMap);
}

export function toVisibleContract<T extends RecordLike>(contract: T | null): T | null {
  if (!contract) {
    return contract;
  }

  const signedClient = Boolean(contract.signedClientAt);
  const signedProfessional = Boolean(contract.signedProAt);
  const signatureStatus = signedClient && signedProfessional
    ? "FULLY_SIGNED"
    : signedClient || signedProfessional
      ? "PARTIALLY_SIGNED"
      : "PENDING_SIGNATURE";

  return {
    ...contract,
    signatureStatus,
    signatureProgress: {
      clientSigned: signedClient,
      professionalSigned: signedProfessional,
      fullySigned: signedClient && signedProfessional
    }
  } as T;
}

export function toVisibleMilestone<T extends RecordLike>(milestone: T): T {
  const visible = withVisibleStatus(milestone, milestoneStatusVisibleMap) as T & {
    reviewDecision?: unknown;
  };

  if (typeof visible.reviewDecision !== "string") {
    return visible as T;
  }

  return {
    ...visible,
    reviewDecision: visible.reviewDecision.toUpperCase()
  } as T;
}

export function toVisibleDispute<T extends RecordLike>(dispute: T): T {
  return withVisibleStatus(dispute, disputeStatusVisibleMap);
}

export function toVisibleEvidence<T extends RecordLike>(evidence: T): T {
  return {
    ...evidence,
    kind: typeof evidence.kind === "string" ? evidence.kind.toUpperCase() : evidence.kind
  } as T;
}

export function toVisiblePaymentTxn<T extends RecordLike>(transaction: T): T {
  const rawType = typeof transaction.type === "string" ? transaction.type : undefined;
  const rawStatus = typeof transaction.status === "string" ? transaction.status : undefined;

  return {
    ...transaction,
    type: rawType ? escrowActionVisibleMap[rawType] ?? rawType.toUpperCase() : transaction.type,
    typeRaw: rawType,
    status: rawStatus ? paymentStatusVisibleMap[rawStatus] ?? rawStatus.toUpperCase() : transaction.status,
    statusRaw: rawStatus
  } as T;
}

export function toVisibleEscrow<T extends RecordLike>(escrow: T | null): T | null {
  if (!escrow) {
    return escrow;
  }

  const rawStatus = typeof escrow.status === "string" ? escrow.status : undefined;
  return {
    ...escrow,
    status: rawStatus ? rawStatus.toUpperCase() : escrow.status,
    statusRaw: rawStatus
  } as T;
}
