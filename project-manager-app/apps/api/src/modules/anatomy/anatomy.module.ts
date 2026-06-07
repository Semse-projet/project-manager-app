import { Module } from "@nestjs/common";
import { AnatomyController } from "./anatomy.controller.js";
import { AnatomyService } from "./anatomy.service.js";

@Module({
  controllers: [AnatomyController],
  providers: [AnatomyService],
  exports: [AnatomyService]
})
export class AnatomyModule {}

