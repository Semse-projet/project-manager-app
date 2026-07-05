import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { type ReservationRecord } from "../../common/domain-store.js";
import { ActorContextService } from "../../infrastructure/persistence/actor-context.service.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

type ActorInput = {
  tenantId: string;
  orgId: string;
  userId: string;
  roles: string[];
};

type StoredReservation = {
  id: string;
  jobId: string;
  professionalOrgId: string | null;
  professionalId: string;
  status: string;
  reservedAt: Date;
  expiresAt: Date;
  releasedAt: Date | null;
  acceptedAt: Date | null;
  job: {
    tenantId: string;
    clientOrgId: string;
  };
};

const reservationSelect = {
  id: true,
  jobId: true,
  professionalOrgId: true,
  professionalId: true,
  status: true,
  reservedAt: true,
  expiresAt: true,
  releasedAt: true,
  acceptedAt: true,
  job: {
    select: {
      id: true,
      tenantId: true,
      clientOrgId: true
    }
  }
} as const;

type ReservationTx = Prisma.TransactionClient & Pick<PrismaService, "job" | "jobReservation" | "project">;

function isActiveReservationUniqueConflict(error: unknown): boolean {
  return (
    (typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2002") ||
    (error instanceof Error && /unique|constraint|active.*reservation/i.test(error.message))
  );
}

@Injectable()
export class ReservationsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actorContextService: ActorContextService
  ) {}

  async listByJob(input: ActorInput & { jobId: string }): Promise<ReservationRecord[]> {
    await this.actorContextService.ensureActorContext(input);

    const job = await this.findJobOrThrow(input);

    const rows = (await this.prisma.jobReservation.findMany({
      where: {
        jobId: input.jobId,
        job: {
          tenantId: input.tenantId,
          deletedAt: null
        }
      },
      select: reservationSelect,
      orderBy: { createdAt: "desc" }
    })) as StoredReservation[];

    const rowsWithOrg = await Promise.all(
      rows.map(async (row) => ({
        ...row,
        professionalOrgId: await this.resolveProfessionalOrgId(input.tenantId, row.professionalId)
      }))
    );

    if (!this.canReadJobReservations(input, job.clientOrgId, rowsWithOrg)) {
      throw new ForbiddenException("actor cannot access reservations for this job");
    }

    return rowsWithOrg
      .filter((row) => this.canReadReservation(input, row))
      .map((row) => this.toRecord(row));
  }

  async create(input: ActorInput & { jobId: string; expiresInMinutes: number }): Promise<ReservationRecord> {
    await this.actorContextService.ensureActorContext(input);
    await this.ensureProfessionalMembership(input);

    const job = await this.findJobOrThrow(input);
    if (job.clientOrgId === input.orgId && !input.roles.includes("OPS_ADMIN")) {
      throw new ForbiddenException("job owner cannot reserve its own job");
    }
    if (!["POSTED", "PUBLISHED", "RESERVED"].includes(job.status)) {
      throw new BadRequestException("job is not eligible for reservation");
    }

    const activeReservation = (await this.prisma.jobReservation.findFirst({
      where: {
        jobId: input.jobId,
        status: "ACTIVE"
      },
      select: reservationSelect
    })) as StoredReservation | null;

    const activeReservationOrgId = activeReservation
      ? await this.resolveProfessionalOrgId(input.tenantId, activeReservation.professionalId)
      : null;

    if (activeReservation && activeReservation.expiresAt.getTime() <= Date.now()) {
      await this.prisma.jobReservation.update({
        where: { id: activeReservation.id },
        data: {
          status: "EXPIRED",
          releasedAt: new Date()
        }
      });
    } else if (activeReservation && activeReservationOrgId !== input.orgId) {
      throw new ConflictException("job already has an active reservation");
    } else if (activeReservation) {
      return this.toRecord({
        ...(activeReservation as StoredReservation),
        professionalOrgId: activeReservationOrgId
      });
    }

    const expiresAt = new Date(Date.now() + input.expiresInMinutes * 60_000);
    let reservation: StoredReservation;
    try {
      reservation = (await this.prisma.$transaction(async (tx) => {
        const db = tx as ReservationTx;
        const created = await db.jobReservation.create({
          data: {
            jobId: input.jobId,
            professionalOrgId: input.orgId,
            professionalId: input.userId,
            status: "ACTIVE",
            expiresAt
          },
          select: reservationSelect
        });

        if (job.status !== "RESERVED") {
          await db.job.update({
            where: { id: job.id },
            data: { status: "RESERVED" }
          });
        }

        return created;
      })) as StoredReservation;
    } catch (error) {
      if (!isActiveReservationUniqueConflict(error)) {
        throw error;
      }

      const currentActive = (await this.prisma.jobReservation.findFirst({
        where: {
          jobId: input.jobId,
          status: "ACTIVE",
          job: {
            tenantId: input.tenantId,
            deletedAt: null
          }
        },
        select: reservationSelect
      })) as StoredReservation | null;
      const currentActiveOrgId = currentActive
        ? await this.resolveProfessionalOrgId(input.tenantId, currentActive.professionalId)
        : null;
      if (currentActive && currentActiveOrgId === input.orgId) {
        return this.toRecord({
          ...currentActive,
          professionalOrgId: currentActiveOrgId
        });
      }

      throw new ConflictException("job already has an active reservation");
    }

    return this.toRecord({
      ...reservation,
      professionalOrgId: input.orgId
    });
  }

  async accept(input: ActorInput & { reservationId: string }): Promise<ReservationRecord> {
    await this.actorContextService.ensureActorContext(input);

    const row = (await this.prisma.jobReservation.findFirst({
      where: {
        id: input.reservationId,
        job: {
          tenantId: input.tenantId,
          deletedAt: null
        }
      },
      select: reservationSelect
    })) as StoredReservation | null;

    if (!row) {
      throw new NotFoundException(`Reservation '${input.reservationId}' not found`);
    }
    if (row.job.clientOrgId !== input.orgId && !input.roles.includes("OPS_ADMIN")) {
      throw new ForbiddenException("actor cannot accept this reservation");
    }
    if (row.status === "ACCEPTED") {
      return this.toRecord({
        ...row,
        professionalOrgId: row.professionalOrgId ?? (await this.resolveProfessionalOrgId(input.tenantId, row.professionalId))
      });
    }
    if (row.status !== "ACTIVE") {
      throw new ConflictException("reservation is not active");
    }
    if (row.expiresAt.getTime() <= Date.now()) {
      throw new ConflictException("reservation already expired");
    }

    const accepted = (await this.prisma.$transaction(async (tx) => {
      const db = tx as ReservationTx;
      const updated = await db.jobReservation.update({
        where: { id: row.id },
        data: {
          status: "ACCEPTED",
          acceptedAt: new Date()
        },
        select: reservationSelect
      });

      await db.job.update({
        where: { id: row.jobId },
        data: { status: "ACCEPTED" }
      });

      const existingProject = await db.project.findFirst({
        where: {
          tenantId: input.tenantId,
          jobId: row.jobId
        }
      });

      const acceptedProfessionalOrgId = await this.resolveProfessionalOrgId(input.tenantId, updated.professionalId);

      if (!existingProject && acceptedProfessionalOrgId) {
        await db.project.create({
          data: {
            tenantId: input.tenantId,
            jobId: row.jobId,
            assignedProOrgId: acceptedProfessionalOrgId,
            status: "OPEN"
          }
        });
      }

      return updated;
    })) as StoredReservation;

    return this.toRecord({
      ...accepted,
      professionalOrgId: accepted.professionalOrgId ?? (await this.resolveProfessionalOrgId(input.tenantId, accepted.professionalId))
    });
  }

  async release(input: ActorInput & { reservationId: string }): Promise<ReservationRecord> {
    await this.actorContextService.ensureActorContext(input);

    const row = await this.findReservationOrThrow(input);
    if (
      (await this.resolveProfessionalOrgId(input.tenantId, row.professionalId)) !== input.orgId &&
      row.job.clientOrgId !== input.orgId &&
      !input.roles.includes("OPS_ADMIN")
    ) {
      throw new ForbiddenException("actor cannot release this reservation");
    }
    if (row.status === "RELEASED") {
      return this.toRecord(row);
    }
    if (row.status !== "ACTIVE") {
      throw new ConflictException("only active reservations can be released");
    }

    const released = (await this.prisma.$transaction(async (tx) => {
      const db = tx as ReservationTx;
      const updated = await db.jobReservation.update({
        where: { id: row.id },
        data: {
          status: "RELEASED",
          releasedAt: new Date()
        },
        select: reservationSelect
      });

      const activeCount = await db.jobReservation.count({
        where: {
          jobId: row.jobId,
          status: "ACTIVE"
        }
      });

      if (activeCount === 0) {
        await db.job.update({
          where: { id: row.jobId },
          data: { status: "POSTED" }
        });
      }

      return updated;
    })) as StoredReservation;

    return this.toRecord({
      ...released,
      professionalOrgId: released.professionalOrgId ?? (await this.resolveProfessionalOrgId(input.tenantId, released.professionalId))
    });
  }

  async expire(input: ActorInput & { reservationId: string }): Promise<ReservationRecord> {
    await this.actorContextService.ensureActorContext(input);

    const row = await this.findReservationOrThrow(input);
    if (!input.roles.includes("OPS_ADMIN")) {
      throw new ForbiddenException("only ops can force expiration");
    }
    if (row.status === "EXPIRED") {
      return this.toRecord(row);
    }
    if (row.status === "RELEASED") {
      return this.toRecord(row);
    }
    if (row.status !== "ACTIVE") {
      throw new ConflictException("only active reservations can expire");
    }

    const expired = (await this.prisma.$transaction(async (tx) => {
      const db = tx as ReservationTx;
      const updated = await db.jobReservation.update({
        where: { id: row.id },
        data: {
          status: "EXPIRED",
          releasedAt: new Date()
        },
        select: reservationSelect
      });

      const activeCount = await db.jobReservation.count({
        where: {
          jobId: row.jobId,
          status: "ACTIVE"
        }
      });

      if (activeCount === 0) {
        await db.job.update({
          where: { id: row.jobId },
          data: { status: "POSTED" }
        });
      }

      return updated;
    })) as StoredReservation;

    return this.toRecord({
      ...expired,
      professionalOrgId: expired.professionalOrgId ?? (await this.resolveProfessionalOrgId(input.tenantId, expired.professionalId))
    });
  }

  async sweepExpired(input: { maxItems?: number }): Promise<{ expiredCount: number; jobsReopened: number }> {
    const now = new Date();
    const limit = input.maxItems ?? 50;

    const stale = await this.prisma.jobReservation.findMany({
      where: {
        status: "ACTIVE",
        expiresAt: { lte: now }
      },
      select: { id: true, jobId: true },
      take: limit
    }) as Array<{ id: string; jobId: string }>;

    if (stale.length === 0) {
      return { expiredCount: 0, jobsReopened: 0 };
    }

    const staleIds = stale.map((r) => r.id);
    const jobIds = Array.from(new Set(stale.map((r) => r.jobId)));

    await this.prisma.jobReservation.updateMany({
      where: { id: { in: staleIds } },
      data: { status: "EXPIRED", releasedAt: now }
    });

    let jobsReopened = 0;
    for (const jobId of jobIds) {
      const stillActive = await this.prisma.jobReservation.count({
        where: { jobId, status: "ACTIVE" }
      });
      if (stillActive === 0) {
        const job = await this.prisma.job.findFirst({
          where: { id: jobId, deletedAt: null },
          select: { id: true, status: true }
        });
        if (job && job.status === "RESERVED") {
          await this.prisma.job.update({
            where: { id: jobId },
            data: { status: "POSTED" }
          });
          jobsReopened++;
        }
      }
    }

    return { expiredCount: stale.length, jobsReopened };
  }

  async findAcceptedByJob(input: ActorInput & { jobId: string }) {
    await this.actorContextService.ensureActorContext(input);

    const row = (await this.prisma.jobReservation.findFirst({
      where: {
        jobId: input.jobId,
        status: "ACCEPTED",
        job: {
          tenantId: input.tenantId
        }
      },
      select: reservationSelect
    })) as StoredReservation | null;

    if (!row) {
      return null;
    }

    const professionalOrgId = await this.resolveProfessionalOrgId(input.tenantId, row.professionalId);
    return {
      ...row,
      professionalOrgId
    };
  }

  private canReadReservation(actor: ActorInput, row: StoredReservation & { professionalOrgId?: string | null }): boolean {
    return (
      actor.roles.includes("OPS_ADMIN") ||
      actor.orgId === row.job.clientOrgId ||
      actor.orgId === row.professionalOrgId
    );
  }

  private canReadJobReservations(
    actor: ActorInput,
    clientOrgId: string,
    rows: Array<StoredReservation & { professionalOrgId?: string | null }>
  ): boolean {
    return (
      actor.roles.includes("OPS_ADMIN") ||
      actor.orgId === clientOrgId ||
      rows.some((row) => row.professionalOrgId === actor.orgId)
    );
  }

  private async findJobOrThrow(input: { tenantId: string; jobId: string }) {
    const job = await this.prisma.job.findFirst({
      where: {
        id: input.jobId,
        tenantId: input.tenantId,
        deletedAt: null
      },
      select: {
        id: true,
        tenantId: true,
        clientOrgId: true,
        status: true
      }
    });

    if (!job) {
      throw new NotFoundException(`Job '${input.jobId}' not found`);
    }

    return job;
  }

  private async findReservationOrThrow(input: { tenantId: string; reservationId: string }) {
    const row = (await this.prisma.jobReservation.findFirst({
      where: {
        id: input.reservationId,
        job: {
          tenantId: input.tenantId
        }
      },
      select: reservationSelect
    })) as StoredReservation | null;

    if (!row) {
      throw new NotFoundException(`Reservation '${input.reservationId}' not found`);
    }

    return row;
  }

  private toRecord(row: StoredReservation & { professionalOrgId?: string | null }): ReservationRecord {
    return {
      id: row.id,
      tenantId: row.job.tenantId,
      jobId: row.jobId,
      professionalId: row.professionalId,
      professionalOrgId: row.professionalOrgId ?? undefined,
      status: row.status.toLowerCase() as ReservationRecord["status"],
      reservedAt: row.reservedAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      releasedAt: row.releasedAt?.toISOString(),
      acceptedAt: row.acceptedAt?.toISOString()
    };
  }

  private async resolveProfessionalOrgId(tenantId: string, professionalId: string): Promise<string | null> {
    const membership = await this.prisma.membership.findFirst({
      where: {
        userId: professionalId,
        org: {
          tenantId,
          type: "pro"
        }
      },
      select: {
        orgId: true
      }
    });

    return membership?.orgId ?? null;
  }

  private async ensureProfessionalMembership(input: ActorInput): Promise<void> {
    const role =
      (await this.prisma.role.findUnique({
        where: { key: "PRO" },
        select: { id: true }
      })) ??
      (await this.prisma.role.create({
        data: {
          key: "PRO",
          name: "Professional"
        },
        select: { id: true }
      }));

    const membership = await this.prisma.membership.findFirst({
      where: {
        userId: input.userId,
        orgId: input.orgId,
        roleId: role.id
      },
      select: { userId: true }
    });

    if (membership) {
      return;
    }

    await this.prisma.membership.create({
      data: {
        userId: input.userId,
        orgId: input.orgId,
        roleId: role.id
      }
    });
  }
}
