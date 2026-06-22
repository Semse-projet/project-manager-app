import { Module, forwardRef } from "@nestjs/common";
import { PrismaModule } from "../../infrastructure/prisma/prisma.module.js";
import { ToolsModule } from "../tools/tools.module.js";
import { PricingModule } from "../pricing/pricing.module.js";
import { PrometeoModule } from "../prometeo/prometeo.module.js";
import { SseInfraModule } from "../../infrastructure/sse/sse-infra.module.js";
import { MatchingModule } from "../matching/matching.module.js";
import { NotificationsModule } from "../notifications/notifications.module.js";
import { SemseAgentsController } from "./semse-agents.controller.js";
import { SemseAgentsService } from "./semse-agents.service.js";
import { ProToolsAgent } from "./protools.agent.js";
import { MarketplaceAgent } from "./marketplace.agent.js";
import { BuildOpsAgent } from "./buildops.agent.js";
import { EvidenceAgent } from "./evidence.agent.js";
import { CrowdAgent } from "./crowd.agent.js";
import { PrometeoAgent } from "./prometeo.agent.js";

const ALL_AGENTS = [SemseAgentsService, ProToolsAgent, MarketplaceAgent, BuildOpsAgent, EvidenceAgent, CrowdAgent, PrometeoAgent];

@Module({
  imports:     [PrismaModule, ToolsModule, PricingModule, SseInfraModule, forwardRef(() => PrometeoModule), MatchingModule, NotificationsModule],
  controllers: [SemseAgentsController],
  providers:   ALL_AGENTS,
  exports:     ALL_AGENTS,
})
export class SemseAgentsModule {}
