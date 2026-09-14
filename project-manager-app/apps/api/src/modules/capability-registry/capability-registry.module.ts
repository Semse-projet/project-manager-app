import { Module } from "@nestjs/common";
import { CapabilityRegistryController } from "./capability-registry.controller.js";
import { CapabilityRegistryService } from "./capability-registry.service.js";

@Module({
  controllers: [CapabilityRegistryController],
  providers: [CapabilityRegistryService],
  exports: [CapabilityRegistryService]
})
export class CapabilityRegistryModule {}
