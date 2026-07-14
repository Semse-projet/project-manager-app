import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { AuthService } from "../auth/auth.service.js";
import {
  DEMO_AGRO_EMAIL,
  DEMO_FARM_NAME,
  DEMO_FARM_RESET_AFTER_MS,
  DEMO_SESSION_TTL_SECONDS,
  DEMO_TENANT_SLUG,
  demoFarmSeed,
} from "./demo-seed.js";

const SUPPORTED_VERTICALS = new Set(["agro"]);

@Injectable()
export class DemoService {
  private readonly logger = new Logger(DemoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  isEnabled(): boolean {
    return process.env.DEMO_MODE_ENABLED === "true";
  }

  supportsVertical(vertical: string): boolean {
    return SUPPORTED_VERTICALS.has(vertical);
  }

  async createDemoSession(input: { vertical: string; requestId: string }) {
    if (!this.isEnabled()) {
      throw new NotFoundException("Demo mode is not enabled");
    }
    if (!this.supportsVertical(input.vertical)) {
      throw new NotFoundException(`Demo vertical not supported: ${input.vertical}`);
    }

    const identity = await this.ensureDemoIdentity();
    const farm = await this.ensureDemoFarm(identity.userId);

    const session = await this.authService.issueSession({
      tenantId: identity.tenantId,
      orgId: identity.orgId,
      userId: identity.userId,
      roles: ["DEMO_AGRO"],
      ttlSeconds: DEMO_SESSION_TTL_SECONDS,
      requestId: input.requestId,
    });

    return {
      ...session,
      demo: true,
      vertical: input.vertical,
      farmId: farm.id,
      expiresInSeconds: DEMO_SESSION_TTL_SECONDS,
      // Identidad completa para que el BFF web construya su cookie de sesión.
      userId: identity.userId,
      tenantId: identity.tenantId,
      orgId: identity.orgId,
      roles: ["DEMO_AGRO"],
    };
  }

  private async ensureDemoIdentity(): Promise<{ tenantId: string; orgId: string; userId: string }> {
    const tenant = await this.prisma.tenant.upsert({
      where: { slug: DEMO_TENANT_SLUG },
      update: {},
      create: { slug: DEMO_TENANT_SLUG, name: "SEMSE Demo", status: "active" },
    });

    let org = await this.prisma.org.findFirst({
      where: { tenantId: tenant.id, type: "demo" },
    });
    if (!org) {
      org = await this.prisma.org.create({
        data: { tenantId: tenant.id, type: "demo", name: "SEMSE Demo Sandbox" },
      });
    }

    const user = await this.prisma.user.upsert({
      where: { email: DEMO_AGRO_EMAIL },
      update: {},
      // Sin passwordHash: la identidad demo no puede iniciar sesión por login normal.
      create: { email: DEMO_AGRO_EMAIL, status: "active" },
    });

    return { tenantId: tenant.id, orgId: org.id, userId: user.id };
  }

  private async ensureDemoFarm(ownerId: string) {
    const existing = await this.prisma.agroFarm.findFirst({
      where: { ownerId, name: DEMO_FARM_NAME },
      orderBy: { createdAt: "desc" },
    });

    if (existing) {
      const ageMs = Date.now() - existing.createdAt.getTime();
      if (ageMs < DEMO_FARM_RESET_AFTER_MS) {
        return existing;
      }
      // Reset lazy: borrar la granja restaura todo el árbol vía onDelete: Cascade.
      await this.prisma.agroFarm.delete({ where: { id: existing.id } });
      this.logger.log(`[demo] farm ${existing.id} reset after ${Math.round(ageMs / 3_600_000)}h`);
    }

    return this.seedDemoFarm(ownerId);
  }

  private async seedDemoFarm(ownerId: string) {
    const now = Date.now();
    const farm = await this.prisma.agroFarm.create({
      data: { ownerId, ...demoFarmSeed.farm },
    });

    const units = await Promise.all(
      demoFarmSeed.units.map((unit) =>
        this.prisma.agroFarmUnit.create({ data: { farmId: farm.id, ...unit } }),
      ),
    );
    const pastureId = units[0]?.id ?? null;

    await this.prisma.agroAnimal.createMany({
      data: demoFarmSeed.animals.map((animal) => ({
        farmId: farm.id,
        currentUnitId: pastureId,
        status: "ACTIVE",
        ...animal,
      })),
    });

    for (const item of demoFarmSeed.inventoryItems) {
      const { initialStock, unitCost, ...itemData } = item;
      const created = await this.prisma.agroInventoryItem.create({
        data: { farmId: farm.id, ...itemData },
      });
      await this.prisma.agroInventoryMovement.create({
        data: {
          farmId: farm.id,
          itemId: created.id,
          movementType: "IN",
          quantity: initialStock,
          unitCost,
          totalCost: initialStock * unitCost,
          occurredAt: new Date(now - 7 * 24 * 3_600_000),
          notes: "Stock inicial (seed demo)",
        },
      });
    }

    await this.prisma.agroFarmTask.createMany({
      data: demoFarmSeed.tasks.map((task) => {
        const { dueInDays, ...taskData } = task;
        return {
          farmId: farm.id,
          targetType: "GENERAL",
          dueAt: new Date(now + dueInDays * 24 * 3_600_000),
          ...(task.status === "COMPLETED" ? { completedAt: new Date(now - 24 * 3_600_000) } : {}),
          ...taskData,
        };
      }),
    });

    await this.prisma.agroCostEntry.createMany({
      data: demoFarmSeed.costEntries.map((entry) => {
        const { daysAgo, ...entryData } = entry;
        return {
          farmId: farm.id,
          sourceType: "MANUAL",
          targetType: "FARM",
          occurredAt: new Date(now - daysAgo * 24 * 3_600_000),
          ...entryData,
        };
      }),
    });

    this.logger.log(`[demo] seeded farm ${farm.id} for owner ${ownerId}`);
    return farm;
  }
}
