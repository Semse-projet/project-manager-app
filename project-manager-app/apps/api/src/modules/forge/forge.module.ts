import { Module } from "@nestjs/common";
import { AgentsModule } from "../agents/agents.module.js";
import { ForgeLeaseService } from "../../infrastructure/forge/forge-lease.service.js";
import { ForgeAgentAdapterService } from "./forge-agent-adapter.service.js";
import { ForgeController } from "./forge.controller.js";
import { ForgeRepository } from "./forge.repository.js";
import { ForgeService } from "./forge.service.js";

@Module({
  imports: [AgentsModule],
  controllers: [ForgeController],
  providers: [ForgeRepository, ForgeService, ForgeAgentAdapterService, ForgeLeaseService],
  exports: [ForgeService, ForgeAgentAdapterService]
})
export class ForgeModule {}
