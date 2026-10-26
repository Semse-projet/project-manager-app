import { Module } from "@nestjs/common";
import { StorageService } from "./storage.service.js";
import { StorageWriteGateCoordinator } from "./storage-write-gate-coordinator.js";
import { StorageWriteOperationBoundary } from "./storage-write-operation-boundary.js";
import { StorageWriteGateTransitionService } from "./storage-write-gate-transition.service.js";
import { StorageWriteGateControlService } from "./storage-write-gate-control.service.js";
import { StorageWriteGateControlController } from "./storage-write-gate-control.controller.js";
import { UploadsController } from "./uploads.controller.js";

@Module({
  controllers: [UploadsController, StorageWriteGateControlController],
  // Runtime writer enforcement and the control plane are both inert unless
  // SEMSE_STORAGE_WRITE_GATE_MODE=staging in a non-production environment.
  providers: [
    StorageWriteGateCoordinator,
    StorageWriteOperationBoundary,
    StorageWriteGateTransitionService,
    StorageWriteGateControlService,
    StorageService,
  ],
  exports: [StorageService],
})
export class StorageModule {}
