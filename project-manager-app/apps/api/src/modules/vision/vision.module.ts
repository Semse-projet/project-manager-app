import { Module } from "@nestjs/common";
import { VisionController } from "./vision.controller.js";
import { VisionService } from "./vision.service.js";
import { VisionRepository } from "./vision.repository.js";
import { VisionServiceClient } from "./clients/vision-service.client.js";
import { VisionLibraryController } from "./vision-library.controller.js";
import { VisionLibraryRepository } from "./vision-library.repository.js";
import { VisionLibraryService } from "./vision-library.service.js";
import { VisionAccessPolicy } from "./vision-access.policy.js";
import { ResourceScopeModule } from "../../common/resource-scope.module.js";
import { StorageModule } from "../../infrastructure/storage/storage.module.js";
import { DecisionLayerModule } from "../ai-models/decision/decision-layer.module.js";

@Module({
  imports: [ResourceScopeModule, StorageModule, DecisionLayerModule],
  controllers: [VisionController, VisionLibraryController],
  providers: [VisionRepository, VisionService, VisionAccessPolicy, VisionServiceClient, VisionLibraryRepository, VisionLibraryService],
  exports: [VisionRepository, VisionService, VisionLibraryService],
})
export class VisionModule {}
