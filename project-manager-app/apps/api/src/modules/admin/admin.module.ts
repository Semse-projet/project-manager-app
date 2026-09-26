import { Module } from "@nestjs/common";
import { AdminController } from "./admin.controller.js";
import { AdminService } from "./admin.service.js";
import { AdminIntegrationsService } from "./admin-integrations.service.js";

@Module({
  controllers: [AdminController],
  providers: [AdminService, AdminIntegrationsService],
  exports: [AdminService],
})
export class AdminModule {}
