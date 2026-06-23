import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { AgroAuditRepository } from "./agro-audit.repository.js";
import { AgroFarmRepository } from "./agro-farm.repository.js";
import { AgroInventoryRepository } from "./agro-inventory.repository.js";

const SUPPORTED_ACTIONS = [
  "farm_task.create",
  "farm_task.complete",
  "farm_task.block",
  "animal.move",
  "animal.weigh",
  "animal_group.move",
  "inventory_movement.create",
  "evidence.note.create",
] as const;

type SupportedAction = typeof SUPPORTED_ACTIONS[number];

interface SyncEvent {
  clientEventId: string;
  farmId: string;
  action: SupportedAction;
  payload: Record<string, unknown>;
  occurredAt: string;
}

interface SyncResult {
  clientEventId: string;
  status: "SYNCED" | "FAILED" | "DUPLICATE";
  error?: string;
}

@Injectable()
export class AgroSyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farmRepo: AgroFarmRepository,
    private readonly inventoryRepo: AgroInventoryRepository,
    private readonly audit: AgroAuditRepository,
  ) {}

  async processSyncEvents(ownerId: string, events: SyncEvent[]): Promise<SyncResult[]> {
    const results: SyncResult[] = [];

    for (const event of events) {
      const result = await this.processSingleEvent(ownerId, event);
      results.push(result);
    }

    return results;
  }

  private async processSingleEvent(ownerId: string, event: SyncEvent): Promise<SyncResult> {
    const { clientEventId, farmId, action, payload, occurredAt } = event;

    // Validate farm ownership
    const farm = await this.farmRepo.findFarm(farmId);
    if (!farm || farm.ownerId !== ownerId) {
      return { clientEventId, status: "FAILED", error: `Farm not found: ${farmId}` };
    }

    // Deduplicate: check if an audit event with this clientEventId already exists
    const existing = await this.prisma.agroAuditEvent.findFirst({
      where: { farmId, action: `sync.${clientEventId}` },
    });
    if (existing) {
      return { clientEventId, status: "DUPLICATE" };
    }

    if (!SUPPORTED_ACTIONS.includes(action as SupportedAction)) {
      return { clientEventId, status: "FAILED", error: `Unsupported action: ${action}` };
    }

    try {
      await this.applyAction(farmId, ownerId, action, payload, new Date(occurredAt));

      // Record dedup marker
      await this.audit.record({
        farmId,
        actorId: ownerId,
        entityType: "SYNC",
        entityId: clientEventId,
        action: `sync.${clientEventId}`,
        after: { action, occurredAt },
        source: "SYNC",
      });

      return { clientEventId, status: "SYNCED" };
    } catch (err: any) {
      return { clientEventId, status: "FAILED", error: err?.message ?? "Unknown error" };
    }
  }

  private async applyAction(
    farmId: string,
    actorId: string,
    action: string,
    payload: Record<string, unknown>,
    occurredAt: Date,
  ) {
    switch (action) {
      case "farm_task.create": {
        await this.prisma.agroFarmTask.create({
          data: {
            farmId,
            title:    String(payload.title ?? "Offline task"),
            type:     String(payload.type ?? "OTHER"),
            status:   "PENDING",
            priority: String(payload.priority ?? "MEDIUM"),
            dueAt:    payload.dueAt ? new Date(String(payload.dueAt)) : undefined,
            notes:    payload.notes ? String(payload.notes) : undefined,
          },
        });
        break;
      }
      case "farm_task.complete": {
        await this.prisma.agroFarmTask.updateMany({
          where: { id: String(payload.taskId), farmId },
          data:  { status: "COMPLETED", completedAt: occurredAt },
        });
        break;
      }
      case "farm_task.block": {
        await this.prisma.agroFarmTask.updateMany({
          where: { id: String(payload.taskId), farmId },
          data:  { status: "BLOCKED", blockedAt: occurredAt, blockReason: payload.reason ? String(payload.reason) : null },
        });
        break;
      }
      case "animal.move": {
        await this.prisma.agroAnimal.updateMany({
          where: { id: String(payload.animalId), farmId },
          data:  { currentUnitId: payload.targetUnitId ? String(payload.targetUnitId) : null },
        });
        break;
      }
      case "animal.weigh": {
        await this.prisma.agroAnimal.updateMany({
          where: { id: String(payload.animalId), farmId },
          data:  { currentWeight: Number(payload.weight) },
        });
        break;
      }
      case "animal_group.move": {
        await this.prisma.agroAnimalGroup.updateMany({
          where: { id: String(payload.groupId), farmId },
          data:  { currentUnitId: payload.targetUnitId ? String(payload.targetUnitId) : null },
        });
        break;
      }
      case "inventory_movement.create": {
        await this.inventoryRepo.createMovement({
          farmId,
          itemId:       String(payload.itemId),
          movementType: String(payload.movementType) as "IN" | "OUT" | "ADJUSTMENT",
          quantity:     payload.quantity ? Number(payload.quantity) : undefined,
          adjustmentDelta: payload.adjustmentDelta ? Number(payload.adjustmentDelta) : undefined,
          unitCost:     payload.unitCost ? Number(payload.unitCost) : undefined,
          occurredAt,
          notes:        payload.notes ? String(payload.notes) : undefined,
        });
        break;
      }
      case "evidence.note.create": {
        await this.prisma.agroEvidenceItem.create({
          data: {
            farmId,
            entityType:  String(payload.entityType ?? "GENERAL"),
            entityId:    payload.entityId ? String(payload.entityId) : undefined,
            mediaType:   "NOTE",
            note:        String(payload.note ?? ""),
            capturedAt:  occurredAt,
            capturedById: actorId,
          },
        });
        break;
      }
      default:
        throw new BadRequestException(`Unsupported action: ${action}`);
    }

    await this.audit.record({
      farmId,
      actorId,
      entityType: "SYNC",
      entityId:   farmId,
      action:     `sync.applied.${action}`,
      after:      { payload, occurredAt },
      source:     "SYNC",
    });
  }
}
