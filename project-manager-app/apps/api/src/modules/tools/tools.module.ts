import { Module } from "@nestjs/common";
import { ToolsController } from "./tools.controller.js";
import { ToolsService } from "./tools.service.js";
import { AlgorithmRunService } from "./algorithm-run.service.js";

@Module({
  controllers: [ToolsController],
  providers: [ToolsService, AlgorithmRunService],
  exports: [ToolsService, AlgorithmRunService],
})
export class ToolsModule {}
