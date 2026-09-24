import { Module } from "@nestjs/common";
import { VisionController } from "./vision.controller.js";
import { VisionService } from "./vision.service.js";
import { VisionRepository } from "./vision.repository.js";
import { VisionServiceClient } from "./clients/vision-service.client.js";
import { VisionLibraryController } from "./vision-library.controller.js";
import { VisionLibraryRepository } from "./vision-library.repository.js";
import { VisionLibraryService } from "./vision-library.service.js";
import { StorageModule } from "../../infrastructure/storage/storage.module.js";

@Module({
  imports: [StorageModule],
  controllers: [VisionController, VisionLibraryController],
  providers: [VisionRepository, VisionService, VisionServiceClient, VisionLibraryRepository, VisionLibraryService],
  exports: [VisionRepository, VisionService, VisionLibraryService],
})
export class VisionModule {}
