import { Module } from "@nestjs/common";
import { AgentQueueModule } from "../../infrastructure/queue/agent-queue.module.js";
import { DeveloperRuntimeApprovalService } from "./developer-runtime.approval.service.js";
import { DeveloperRuntimeController } from "./developer-runtime.controller.js";
import { DeveloperRuntimeRepository } from "./developer-runtime.repository.js";
import { DeveloperRuntimeShellService } from "./developer-runtime.shell.service.js";
import { DeveloperRuntimeService } from "./developer-runtime.service.js";
import { DeveloperRuntimeStorageService } from "./developer-runtime.storage.service.js";
import { DeveloperRuntimeValidationService } from "./developer-runtime.validation.service.js";

@Module({
  imports: [AgentQueueModule],
  controllers: [DeveloperRuntimeController],
  providers: [
    DeveloperRuntimeService,
    DeveloperRuntimeRepository,
    DeveloperRuntimeStorageService,
    DeveloperRuntimeApprovalService,
    DeveloperRuntimeShellService,
    DeveloperRuntimeValidationService,
  ],
  exports: [
    DeveloperRuntimeService,
    DeveloperRuntimeRepository,
    DeveloperRuntimeStorageService,
    DeveloperRuntimeApprovalService,
    DeveloperRuntimeShellService,
    DeveloperRuntimeValidationService,
  ],
})
export class DeveloperRuntimeModule {}
