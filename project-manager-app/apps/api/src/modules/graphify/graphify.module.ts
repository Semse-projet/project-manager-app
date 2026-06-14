import { Module } from "@nestjs/common";
import { GraphifyService } from "./graphify.service.js";

@Module({
  providers: [GraphifyService],
  exports: [GraphifyService],
})
export class GraphifyModule {}
