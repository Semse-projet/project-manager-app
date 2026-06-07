import { Global, Module } from "@nestjs/common";
import { AuditService } from "../audit/audit.service.js";
import { ObservabilityModule } from "../observability/observability.module.js";
import { ActorContextService } from "../persistence/actor-context.service.js";
import { PrismaService } from "./prisma.service.js";

@Global()
@Module({
  imports: [ObservabilityModule],
  providers: [PrismaService, ActorContextService, AuditService],
  exports: [PrismaService, ActorContextService, AuditService]
})
export class PrismaModule {}
