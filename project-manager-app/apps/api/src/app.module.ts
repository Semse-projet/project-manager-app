import path from "node:path";
import { fileURLToPath } from "node:url";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { HealthController } from "./modules/health/health.controller.js";
import { AuthGuard } from "./common/auth.guard.js";
import { RbacGuard } from "./common/rbac.guard.js";
import { validateApiEnv } from "./config/env.schema.js";
import { AuthModule } from "./modules/auth/auth.module.js";
import { AgentsModule } from "./modules/agents/agents.module.js";
import { PrismaModule } from "./infrastructure/prisma/prisma.module.js";
import { BidsModule } from "./modules/bids/bids.module.js";
import { ContractsModule } from "./modules/contracts/contracts.module.js";
import { DisputesModule } from "./modules/disputes/disputes.module.js";
import { EvidenceModule } from "./modules/evidence/evidence.module.js";
import { JobsModule } from "./modules/jobs/jobs.module.js";
import { MilestonesModule } from "./modules/milestones/milestones.module.js";
import { OpsModule } from "./modules/ops/ops.module.js";
import { PaymentsModule } from "./modules/payments/payments.module.js";
import { ProjectsModule } from "./modules/projects/projects.module.js";
import { ReservationsModule } from "./modules/reservations/reservations.module.js";
import { TrustModule } from "./modules/trust/trust.module.js";
import { FieldOpsModule } from "./modules/field-ops/field-ops.module.js";
import { DomainEventsModule } from "./modules/domain-events/domain-events.module.js";
import { OrganizationsModule } from "./modules/organizations/organizations.module.js";
import { RatingsModule } from "./modules/ratings/ratings.module.js";
import { UsersModule } from "./modules/users/users.module.js";
import { AutonomyModule } from "./modules/autonomy/autonomy.module.js";
import { AnatomyModule } from "./modules/anatomy/anatomy.module.js";
import { RepoKnowledgeModule } from "./modules/repo-knowledge/repo-knowledge.module.js";
import { RuntimeKnowledgeModule } from "./modules/runtime-knowledge/runtime-knowledge.module.js";
import { KnowledgeModule } from "./modules/knowledge/knowledge.module.js";
import { MatchingModule } from "./modules/matching/matching.module.js";
import { TasksModule } from "./modules/tasks/tasks.module.js";
import { IncidentsModule } from "./modules/incidents/incidents.module.js";
import { MaterialsModule } from "./modules/materials/materials.module.js";
import { TravelModule } from "./modules/travel/travel.module.js";
import { DeveloperRuntimeModule } from "./modules/developer-runtime/developer-runtime.module.js";
import { NotificationsModule } from "./modules/notifications/notifications.module.js";
import { MarketplaceModule } from "./modules/marketplace/marketplace.module.js";
import { SemseAgentsModule } from "./modules/semse-agents/semse-agents.module.js";
import { PrometeoModule } from "./modules/prometeo/prometeo.module.js";
import { AiModelsModule } from "./modules/ai-models/ai-models.module.js";
import { StorageModule } from "./infrastructure/storage/storage.module.js";
import { SseInfraModule } from "./infrastructure/sse/sse-infra.module.js";
import { SseModule } from "./infrastructure/sse/sse.module.js";
import { FinanceModule } from "./modules/finance/finance.module.js";
import { IntelligenceModule } from "./modules/intelligence/intelligence.module.js";
import { PdfModule } from "./common/pdf/pdf.module.js";
import { ContractorModule } from "./modules/contractor/contractor.module.js";
import { AssistantModule } from "./modules/assistant/assistant.module.js";
import { ToolsModule } from "./modules/tools/tools.module.js";
import { BuildOpsModule } from "./modules/buildops/buildops.module.js";
import { SmartIntakeModule } from "./modules/smart-intake/smart-intake.module.js";
import { IntakeOperationsBridgeModule } from "./modules/intake-operations-bridge/intake-operations-bridge.module.js";
import { ChangeOrdersModule } from "./modules/change-orders/change-orders.module.js";
import { OperationalIntelligenceModule } from "./modules/operational-intelligence/operational-intelligence.module.js";
import { CommunicationsModule } from "./modules/communications/communications.module.js";
import { PricingModule } from "./modules/pricing/pricing.module.js";
import { DidModule } from "./modules/did/did.module.js";
import { GovernanceModule } from "./modules/governance/governance.module.js";
import { PaymentGovernanceModule } from "./modules/payment-governance/payment-governance.module.js";
import { EvidenceGatewayModule } from "./modules/evidence-gateway/evidence-gateway.module.js";

const appDir = path.dirname(fileURLToPath(import.meta.url));
const apiDir = path.resolve(appDir, "..");
const repoRoot = path.resolve(apiDir, "..", "..");

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        path.resolve(apiDir, ".env"),          // apps/api/.env  (API-level — LLM keys, ports, etc.)
        path.resolve(repoRoot, "packages/db/.env"),  // packages/db/.env (DATABASE_URL)
      ],
      validate: validateApiEnv
    }),
    ThrottlerModule.forRoot([
      {
        ttl: Number(process.env.RATE_LIMIT_TTL_SECONDS ?? 60) * 1000,
        limit: Number(process.env.RATE_LIMIT_LIMIT ?? 20)
      }
    ]),
    PrismaModule,
    PdfModule,
    SseInfraModule,
    AuthModule,
    AgentsModule,
    DomainEventsModule,
    JobsModule,
    ContractsModule,
    BidsModule,
    DisputesModule,
    EvidenceModule,
    MilestonesModule,
    OpsModule,
    ProjectsModule,
    PaymentsModule,
    ReservationsModule,
    TrustModule,
    FieldOpsModule,
    OrganizationsModule,
    RatingsModule,
    UsersModule,
    AutonomyModule,
    AnatomyModule,
    RepoKnowledgeModule,
    RuntimeKnowledgeModule,
    KnowledgeModule,
    MatchingModule,
    TasksModule,
    IncidentsModule,
    MaterialsModule,
    TravelModule,
    DeveloperRuntimeModule,
    NotificationsModule,
    MarketplaceModule,
    SemseAgentsModule,
    PrometeoModule,
    AiModelsModule,
    StorageModule,
    SseModule,
    FinanceModule,
    IntelligenceModule,
    ContractorModule,
    AssistantModule,
    ToolsModule,
    BuildOpsModule,
    SmartIntakeModule,
    IntakeOperationsBridgeModule,
    ChangeOrdersModule,
    OperationalIntelligenceModule,
    CommunicationsModule,
    PricingModule,
    DidModule,
    GovernanceModule,
    PaymentGovernanceModule,
    EvidenceGatewayModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RbacGuard }
  ]
})
export class AppModule {}

