import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
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

/**
 * Cliente transaccional de Prisma, tipado de forma estructural con los modelos
 * que toca el sync. Estructural y no `Prisma.TransactionClient` para que los
 * tests puedan seguir pasando un stub, que es como esta escrita la suite.
 */
export type AgroSyncTxClient = {
  agroAuditEvent:        { create(args: any): Promise<unknown> };
  agroFarmTask:          { create(args: any): Promise<unknown>; updateMany(args: any): Promise<{ count: number }> };
  agroAnimal:            { updateMany(args: any): Promise<{ count: number }> };
  agroAnimalGroup:       { updateMany(args: any): Promise<{ count: number }> };
  agroEvidenceItem:      { create(args: any): Promise<unknown> };
  agroInventoryMovement: { create(args: any): Promise<unknown> };
};

@Injectable()
export class AgroSyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farmRepo: AgroFarmRepository,
    private readonly inventoryRepo: AgroInventoryRepository,
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

    if (!SUPPORTED_ACTIONS.includes(action as SupportedAction)) {
      return { clientEventId, status: "FAILED", error: `Unsupported action: ${action}` };
    }

    try {
      // El marcador de dedup se inserta DENTRO de la misma transaccion que
      // aplica la accion, y es lo primero que ocurre: el indice unico
      // (farmId, clientEventId) es la puerta. Asi un reintento concurrente
      // choca contra la base en vez de contra un findFirst que ya quedo
      // obsoleto, y si aplicar falla se revierte tambien el marcador, dejando
      // el evento reintentable en vez de marcado como hecho.
      await this.prisma.$transaction(async (tx: AgroSyncTxClient) => {
        await tx.agroAuditEvent.create({
          data: {
            farmId,
            actorId: ownerId,
            entityType: "SYNC",
            entityId: clientEventId,
            action: `sync.${clientEventId}`,
            after: { action, occurredAt } as never,
            source: "SYNC",
            clientEventId,
          },
        });

        await this.applyAction(tx, farmId, ownerId, action, payload, new Date(occurredAt));
      });

      return { clientEventId, status: "SYNCED" };
    } catch (err: any) {
      // P2002 = violacion de unique. Es el reintento del mismo evento, que es
      // precisamente lo que la cola offline hace cuando vuelve la señal.
      if (err?.code === "P2002") {
        return { clientEventId, status: "DUPLICATE" };
      }
      return { clientEventId, status: "FAILED", error: err?.message ?? "Unknown error" };
    }
  }

  private async applyAction(
    tx: AgroSyncTxClient,
    farmId: string,
    actorId: string,
    action: string,
    payload: Record<string, unknown>,
    occurredAt: Date,
  ) {
    // Un updateMany que no toca ninguna fila significa que la entidad no
    // existe o no pertenece a la finca. Antes eso devolvia SYNCED sin haber
    // hecho nada: el cliente borraba el evento de su cola creyendo que se
    // habia aplicado. Lanzar revierte la transaccion y lo deja como FAILED.
    const mustAffectRows = (result: { count: number }, what: string) => {
      if (result.count === 0) {
        throw new BadRequestException(`${what} not found in farm ${farmId}`);
      }
    };

    switch (action) {
      case "farm_task.create": {
        await tx.agroFarmTask.create({
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
        const res = await tx.agroFarmTask.updateMany({
          where: { id: String(payload.taskId), farmId },
          data:  { status: "COMPLETED", completedAt: occurredAt },
        });
        mustAffectRows(res, `Task ${String(payload.taskId)}`);
        break;
      }
      case "farm_task.block": {
        const res = await tx.agroFarmTask.updateMany({
          where: { id: String(payload.taskId), farmId },
          data:  { status: "BLOCKED", blockedAt: occurredAt, blockReason: payload.reason ? String(payload.reason) : null },
        });
        mustAffectRows(res, `Task ${String(payload.taskId)}`);
        break;
      }
      case "animal.move": {
        const res = await tx.agroAnimal.updateMany({
          where: { id: String(payload.animalId), farmId },
          data:  { currentUnitId: payload.targetUnitId ? String(payload.targetUnitId) : null },
        });
        mustAffectRows(res, `Animal ${String(payload.animalId)}`);
        break;
      }
      case "animal.weigh": {
        const res = await tx.agroAnimal.updateMany({
          where: { id: String(payload.animalId), farmId },
          data:  { currentWeight: Number(payload.weight) },
        });
        mustAffectRows(res, `Animal ${String(payload.animalId)}`);
        break;
      }
      case "animal_group.move": {
        const res = await tx.agroAnimalGroup.updateMany({
          where: { id: String(payload.groupId), farmId },
          data:  { currentUnitId: payload.targetUnitId ? String(payload.targetUnitId) : null },
        });
        mustAffectRows(res, `Group ${String(payload.groupId)}`);
        break;
      }
      case "inventory_movement.create": {
        await this.inventoryRepo.createMovement(
          {
            farmId,
            itemId:       String(payload.itemId),
            movementType: String(payload.movementType) as "IN" | "OUT" | "ADJUSTMENT",
            quantity:     payload.quantity ? Number(payload.quantity) : undefined,
            adjustmentDelta: payload.adjustmentDelta ? Number(payload.adjustmentDelta) : undefined,
            unitCost:     payload.unitCost ? Number(payload.unitCost) : undefined,
            occurredAt,
            notes:        payload.notes ? String(payload.notes) : undefined,
          },
          tx,
        );
        break;
      }
      case "evidence.note.create": {
        await tx.agroEvidenceItem.create({
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

    // Traza de la accion aplicada, dentro de la misma transaccion. Va sin
    // clientEventId: el unique (farmId, clientEventId) es solo para el
    // marcador de dedup, y varias acciones por finca comparten este `action`.
    await tx.agroAuditEvent.create({
      data: {
        farmId,
        actorId,
        entityType: "SYNC",
        entityId:   farmId,
        action:     `sync.applied.${action}`,
        after:      { payload, occurredAt } as never,
        source:     "SYNC",
      },
    });
  }
}
