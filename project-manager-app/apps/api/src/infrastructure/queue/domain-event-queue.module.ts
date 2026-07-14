import { Module } from "@nestjs/common";
import { DomainEventQueueService } from "./domain-event-queue.service.js";

@Module({
  providers: [DomainEventQueueService],
  exports: [DomainEventQueueService],
})
export class DomainEventQueueModule {}
