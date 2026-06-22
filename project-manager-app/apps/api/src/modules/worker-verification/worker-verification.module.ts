import { Module } from "@nestjs/common";
import { WorkerVerificationController } from "./worker-verification.controller.js";
import { WorkerVerificationService } from "./worker-verification.service.js";
import { WorkerVerificationRepository } from "./worker-verification.repository.js";
import { SseModule } from "../../infrastructure/sse/sse.module.js";

@Module({
  imports: [SseModule],
  controllers: [WorkerVerificationController],
  providers: [WorkerVerificationService, WorkerVerificationRepository],
  exports: [WorkerVerificationService],
})
export class WorkerVerificationModule {}
