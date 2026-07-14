import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { DemoController } from "./demo.controller.js";
import { DemoService } from "./demo.service.js";

@Module({
  imports: [AuthModule],
  controllers: [DemoController],
  providers: [DemoService],
})
export class DemoModule {}
