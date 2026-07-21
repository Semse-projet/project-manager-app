import { Module } from "@nestjs/common";
import { EmailService } from "../../infrastructure/email/email.service.js";
import { AuthController } from "./auth.controller.js";
import { AuthRepository } from "./auth.repository.js";
import { AuthService } from "./auth.service.js";

@Module({
  controllers: [AuthController],
  providers: [AuthService, AuthRepository, EmailService],
  exports: [AuthService]
})
export class AuthModule {}
