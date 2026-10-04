import { Module } from "@nestjs/common";
import { ResourceScopeModule } from "../../common/resource-scope.module.js";
import { TasksController } from "./tasks.controller.js";
import { TasksService } from "./tasks.service.js";

@Module({
  imports: [ResourceScopeModule],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
