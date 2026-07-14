import { Module } from "@nestjs/common";
import { WorkerVerificationController } from "./worker-verification.controller.js";
import { WorkerVerificationService } from "./worker-verification.service.js";
import { WorkerVerificationRepository } from "./worker-verification.repository.js";
import { WorkerApplicationController } from "./worker-application.controller.js";
import { WorkerApplicationService } from "./worker-application.service.js";
import { WorkerApplicationRepository } from "./worker-application.repository.js";
import { SseModule } from "../../infrastructure/sse/sse.module.js";

@Module({
  imports: [SseModule],
  controllers: [WorkerApplicationController, WorkerVerificationController],
  providers: [
    WorkerVerificationService,
    WorkerVerificationRepository,
    WorkerApplicationService,
    WorkerApplicationRepository,
  ],
  exports: [WorkerVerificationService, WorkerApplicationService],
})
export class WorkerVerificationModule {}
