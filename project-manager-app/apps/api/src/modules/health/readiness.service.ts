import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { StorageService } from "../../infrastructure/storage/storage.service.js";
import { HealthService } from "./health.service.js";
import { checkReadiness, type ReadinessReport } from "./readiness.logic.js";

@Injectable()
export class ReadinessService {
  private readonly prisma: PrismaService;
  private readonly health: HealthService;
  private readonly storage: StorageService;

  constructor(
    prisma: PrismaService,
    health: HealthService,
    storage: StorageService
  ) {
    this.prisma = prisma;
    this.health = health;
    this.storage = storage;
  }

  async check(): Promise<ReadinessReport> {
    return checkReadiness({
      queryRawUnsafe: this.prisma.$queryRawUnsafe.bind(this.prisma),
      refreshHealth: this.health.refreshNow.bind(this.health),
      storageHealthCheck: this.storage.healthCheck.bind(this.storage)
    });
  }
}
