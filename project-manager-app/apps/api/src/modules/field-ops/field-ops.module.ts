import { Module } from "@nestjs/common";
import { ResourceScopeModule } from "../../common/resource-scope.module.js";
import { ProjectAccessService } from "../agents/project-access.service.js";
import { FieldOpsController } from "./field-ops.controller.js";
import { FieldOpsRepository } from "./field-ops.repository.js";
import { FieldOpsService } from "./field-ops.service.js";
import { TimeTrackerController } from "./time-tracker.controller.js";

@Module({
  imports: [ResourceScopeModule],
  controllers: [FieldOpsController, TimeTrackerController],
  providers: [FieldOpsRepository, FieldOpsService, ProjectAccessService],
  exports: [FieldOpsRepository, FieldOpsService],
})
export class FieldOpsModule {}
