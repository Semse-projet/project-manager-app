import { Module, forwardRef } from "@nestjs/common";
import { AiModelsModule } from "../ai-models/ai-models.module.js";
import { DomainEventsModule } from "../domain-events/domain-events.module.js";
import { KnowledgeModule } from "../knowledge/knowledge.module.js";
import { OperationalIntelligenceModule } from "../operational-intelligence/operational-intelligence.module.js";
import { PrismaModule } from "../../infrastructure/prisma/prisma.module.js";
import { MilestonesController } from "./milestones.controller.js";
import { MilestonesRepository } from "./milestones.repository.js";
import { MilestonesService } from "./milestones.service.js";
import { PaymentGovernanceService } from "../payments/payment-governance.service.js";

@Module({
  imports: [
    DomainEventsModule,
    KnowledgeModule,
    PrismaModule,
    forwardRef(() => AiModelsModule),
    OperationalIntelligenceModule,
  ],
  controllers: [MilestonesController],
  providers: [MilestonesRepository, MilestonesService, PaymentGovernanceService],
  exports: [MilestonesRepository, MilestonesService]
})
export class MilestonesModule {}
