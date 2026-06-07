import { Module } from "@nestjs/common";
import { FieldOpsController } from "./field-ops.controller.js";
import { FieldOpsRepository } from "./field-ops.repository.js";
import { FieldOpsService } from "./field-ops.service.js";

@Module({
  controllers: [FieldOpsController],
  providers: [FieldOpsRepository, FieldOpsService],
  exports: [FieldOpsRepository, FieldOpsService],
})
export class FieldOpsModule {}
