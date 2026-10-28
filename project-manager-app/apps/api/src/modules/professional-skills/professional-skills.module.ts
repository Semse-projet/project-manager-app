import { Module } from "@nestjs/common";
import { MySkillsController, SkillRedeemController, SkillReviewController } from "./skills.controller.js";
import { SkillsService } from "./skills.service.js";

/**
 * BO-12 — experiencia profesional confirmada y atestaciones.
 * Nombre propio a propósito: `modules/skills` ya existe y es el cargador de skills de contexto de Prometeo.
 */
@Module({
  controllers: [SkillReviewController, MySkillsController, SkillRedeemController],
  providers: [SkillsService]
})
export class ProfessionalSkillsModule {}
