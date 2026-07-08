import { Module } from "@nestjs/common";
import { AgroAuditRepository } from "./agro-audit.repository.js";
import { AgroFarmController } from "./agro-farm.controller.js";
import { AgroFarmRepository } from "./agro-farm.repository.js";
import { AgroFarmService } from "./agro-farm.service.js";
import { AgroAnimalRepository } from "./agro-animal.repository.js";
import { AgroAnimalService } from "./agro-animal.service.js";
import { AgroAnimalController } from "./agro-animal.controller.js";
import { AgroTaskRepository } from "./agro-task.repository.js";
import { AgroTaskService } from "./agro-task.service.js";
import { AgroTaskController } from "./agro-task.controller.js";
import { AgroInventoryRepository } from "./agro-inventory.repository.js";
import { AgroInventoryService } from "./agro-inventory.service.js";
import { AgroInventoryController } from "./agro-inventory.controller.js";
import { AgroEvidenceRepository } from "./agro-evidence.repository.js";
import { AgroEvidenceService } from "./agro-evidence.service.js";
import { AgroEvidenceController } from "./agro-evidence.controller.js";
import { AgroDashboardService } from "./agro-dashboard.service.js";
import { AgroAuditReportService } from "./agro-audit-report.service.js";
import { AgroSyncService } from "./agro-sync.service.js";
import { AgroDashboardController } from "./agro-dashboard.controller.js";
import { AgroProductionCycleService } from "./agro-production-cycle.service.js";
import { AgroProductionCycleController } from "./agro-production-cycle.controller.js";
import { AgroTraceabilityService } from "./agro-traceability.service.js";
import { AgroTraceabilityController } from "./agro-traceability.controller.js";
import { AgroEconomicsRepository } from "./agro-economics.repository.js";
import { AgroProductionService } from "./agro-production.service.js";
import { AgroProfitabilityService } from "./agro-profitability.service.js";
import { AgroSaleService } from "./agro-sale.service.js";
import { AgroSimulatorService } from "./agro-simulator.service.js";
import { AgroEconomicsController } from "./agro-economics.controller.js";

@Module({
  controllers: [
    AgroFarmController,
    AgroAnimalController,
    AgroTaskController,
    AgroInventoryController,
    AgroEvidenceController,
    AgroDashboardController,
    AgroProductionCycleController,
    AgroTraceabilityController,
    AgroEconomicsController,
  ],
  providers: [
    AgroFarmRepository,
    AgroAuditRepository,
    AgroFarmService,
    AgroAnimalRepository,
    AgroAnimalService,
    AgroTaskRepository,
    AgroTaskService,
    AgroInventoryRepository,
    AgroInventoryService,
    AgroEvidenceRepository,
    AgroEvidenceService,
    AgroDashboardService,
    AgroAuditReportService,
    AgroSyncService,
    AgroProductionCycleService,
    AgroTraceabilityService,
    AgroEconomicsRepository,
    AgroProductionService,
    AgroProfitabilityService,
    AgroSaleService,
    AgroSimulatorService,
  ],
  exports: [
    AgroFarmService,
    AgroAnimalService,
    AgroTaskService,
    AgroInventoryService,
    AgroEvidenceService,
    AgroDashboardService,
    AgroAuditRepository,
    AgroProductionCycleService,
    AgroTraceabilityService,
    AgroProductionService,
    AgroProfitabilityService,
    AgroSaleService,
    AgroSimulatorService,
  ],
})
export class AgroModule {}
