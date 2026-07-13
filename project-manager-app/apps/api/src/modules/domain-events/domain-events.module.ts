import { Module, forwardRef } from "@nestjs/common";
import { PrismaModule } from "../../infrastructure/prisma/prisma.module.js";
import { AgentsModule } from "../agents/agents.module.js";
import { AiModelsModule } from "../ai-models/ai-models.module.js";
import { MatchingModule } from "../matching/matching.module.js";
import { NotificationsModule } from "../notifications/notifications.module.js";
import { AgentTriggerRouter } from "./agent-trigger-router.service.js";
import { DomainEventsController } from "./domain-events.controller.js";
import { DomainEventsRepository } from "./domain-events.repository.js";
import { DomainEventsService } from "./domain-events.service.js";
import { DomainEventBus } from "./domain-event-bus.service.js";
import { OutboxRepository } from "./outbox.repository.js";

@Module({
  controllers: [DomainEventsController],
  imports: [
    PrismaModule,
    forwardRef(() => AgentsModule),
    forwardRef(() => AiModelsModule),
    MatchingModule,
    NotificationsModule,
  ],
  providers: [
    DomainEventsRepository,
    DomainEventsService,
    DomainEventBus,
    AgentTriggerRouter,
    OutboxRepository,
  ],
  exports: [DomainEventBus, DomainEventsService, OutboxRepository],
})
export class DomainEventsModule {}
