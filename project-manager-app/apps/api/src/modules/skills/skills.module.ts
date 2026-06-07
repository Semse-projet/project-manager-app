import { Module } from "@nestjs/common";
import { SkillLoaderService } from "./skill-loader.service.js";
import { SkillMatcherService } from "./skill-matcher.service.js";

@Module({
  providers: [SkillLoaderService, SkillMatcherService],
  exports: [SkillLoaderService, SkillMatcherService],
})
export class SkillsModule {}
