import { Module } from "@nestjs/common";
import { ChangeOrdersController } from "./change-orders.controller.js";
import { ChangeOrdersService } from "./change-orders.service.js";

@Module({
  controllers: [ChangeOrdersController],
  providers: [ChangeOrdersService],
  exports: [ChangeOrdersService],
})
export class ChangeOrdersModule {}
