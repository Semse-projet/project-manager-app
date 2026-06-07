import { BadRequestException, Injectable } from "@nestjs/common";
import { type ReservationRecord } from "../../common/domain-store.js";
import { AuditService } from "../../infrastructure/audit/audit.service.js";
import { ReservationsRepository } from "./reservations.repository.js";

@Injectable()
export class ReservationsService {
  constructor(
    private readonly reservationsRepository: ReservationsRepository,
    private readonly auditService: AuditService
  ) {}

  async list(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    roles: string[];
    jobId: string;
  }): Promise<ReservationRecord[]> {
    return this.reservationsRepository.listByJob(input);
  }

  async create(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    roles: string[];
    jobId: string;
    expiresInMinutes?: number;
    requestId: string;
  }): Promise<ReservationRecord> {
    const expiresInMinutes = input.expiresInMinutes ?? 30;
    if (expiresInMinutes <= 0 || expiresInMinutes > 1440) {
      throw new BadRequestException("expiresInMinutes must be between 1 and 1440");
    }

    const reservation = await this.reservationsRepository.create({
      ...input,
      expiresInMinutes
    });

    await this.auditService.append({
      id: `aud_${Date.now()}`,
      tenantId: input.tenantId,
      orgId: input.orgId,
      actorUserId: input.userId,
      action: "reservation.create",
      entityType: "JobReservation",
      entityId: reservation.id,
      requestId: input.requestId,
      timestamp: new Date().toISOString()
    });

    return reservation;
  }

  async accept(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    roles: string[];
    reservationId: string;
    requestId: string;
  }): Promise<ReservationRecord> {
    const reservation = await this.reservationsRepository.accept(input);

    await this.auditService.append({
      id: `aud_${Date.now()}`,
      tenantId: input.tenantId,
      orgId: input.orgId,
      actorUserId: input.userId,
      action: "reservation.accept",
      entityType: "JobReservation",
      entityId: reservation.id,
      requestId: input.requestId,
      timestamp: new Date().toISOString()
    });

    return reservation;
  }

  async release(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    roles: string[];
    reservationId: string;
    requestId: string;
  }): Promise<ReservationRecord> {
    const reservation = await this.reservationsRepository.release(input);

    await this.auditService.append({
      id: `aud_${Date.now()}`,
      tenantId: input.tenantId,
      orgId: input.orgId,
      actorUserId: input.userId,
      action: "reservation.release",
      entityType: "JobReservation",
      entityId: reservation.id,
      requestId: input.requestId,
      timestamp: new Date().toISOString()
    });

    return reservation;
  }

  async sweepExpired(input: { maxItems?: number }): Promise<{ expiredCount: number; jobsReopened: number }> {
    return this.reservationsRepository.sweepExpired(input);
  }

  async expire(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    roles: string[];
    reservationId: string;
    requestId: string;
  }): Promise<ReservationRecord> {
    const reservation = await this.reservationsRepository.expire(input);

    await this.auditService.append({
      id: `aud_${Date.now()}`,
      tenantId: input.tenantId,
      orgId: input.orgId,
      actorUserId: input.userId,
      action: "reservation.expire",
      entityType: "JobReservation",
      entityId: reservation.id,
      requestId: input.requestId,
      timestamp: new Date().toISOString()
    });

    return reservation;
  }
}
