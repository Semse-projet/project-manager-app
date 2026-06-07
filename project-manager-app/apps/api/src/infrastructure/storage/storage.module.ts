import { Module } from "@nestjs/common";
import { StorageService } from "./storage.service.js";
import { UploadsController } from "./uploads.controller.js";

@Module({
  controllers: [UploadsController],
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
