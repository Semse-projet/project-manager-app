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
  // Runtime writer enforcement is inert unless explicitly enabled for the
  // matching environment. Production control is OPEN-canary observe/provision
  // only; drain/freeze/thaw remain blocked in this slice.
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
