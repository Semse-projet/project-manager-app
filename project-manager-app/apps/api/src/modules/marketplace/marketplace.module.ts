import { Module } from "@nestjs/common";
import { PrismaModule } from "../../infrastructure/prisma/prisma.module.js";
import { MarketplaceController } from "./marketplace.controller.js";
import { MarketplaceService } from "./marketplace.service.js";

@Module({
  imports:     [PrismaModule],
  controllers: [MarketplaceController],
  providers:   [MarketplaceService],
  exports:     [MarketplaceService],
})
export class MarketplaceModule {}
