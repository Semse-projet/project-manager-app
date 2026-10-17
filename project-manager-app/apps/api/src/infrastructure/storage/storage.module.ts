import { Module } from "@nestjs/common";
import { StorageService } from "./storage.service.js";
import { StorageWriteGateCoordinator } from "./storage-write-gate-coordinator.js";
import { StorageWriteOperationBoundary } from "./storage-write-operation-boundary.js";
import { UploadsController } from "./uploads.controller.js";

@Module({
  controllers: [UploadsController],
  // Wiring is inert unless SEMSE_STORAGE_WRITE_GATE_MODE=staging (non-production).
  // TransitionService intentionally not exposed: no unreviewed freeze API.
  providers: [StorageWriteGateCoordinator, StorageWriteOperationBoundary, StorageService],
  exports: [StorageService],
})
export class StorageModule {}
