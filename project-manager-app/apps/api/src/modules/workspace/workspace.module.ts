import { Module } from "@nestjs/common";
import { WorkspaceController } from "./workspace.controller.js";
import {
  PrismaWorkspaceStateRepository,
  WORKSPACE_STATE_REPOSITORY,
} from "./workspace.repository.js";
import { WorkspaceService } from "./workspace.service.js";

@Module({
  controllers: [WorkspaceController],
  providers: [
    WorkspaceService,
    { provide: WORKSPACE_STATE_REPOSITORY, useClass: PrismaWorkspaceStateRepository },
  ],
  exports: [WorkspaceService],
})
export class WorkspaceModule {}
