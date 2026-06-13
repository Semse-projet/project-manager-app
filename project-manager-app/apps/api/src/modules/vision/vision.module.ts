import { Module } from "@nestjs/common";
import { VisionController } from "./vision.controller.js";
import { VisionService } from "./vision.service.js";
import { VisionRepository } from "./vision.repository.js";
import { VisionServiceClient } from "./clients/vision-service.client.js";
import { StorageModule } from "../../infrastructure/storage/storage.module.js";

@Module({
  imports: [StorageModule],
  controllers: [VisionController],
  providers: [VisionRepository, VisionService, VisionServiceClient],
  exports: [VisionRepository, VisionService],
})
export class VisionModule {}
