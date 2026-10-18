import { Module } from "@nestjs/common";
import { MySkillsController, SkillRedeemController, SkillReviewController } from "./skills.controller.js";
import { SkillsService } from "./skills.service.js";

@Module({
  controllers: [SkillReviewController, MySkillsController, SkillRedeemController],
  providers: [SkillsService]
})
export class SkillsModule {}
