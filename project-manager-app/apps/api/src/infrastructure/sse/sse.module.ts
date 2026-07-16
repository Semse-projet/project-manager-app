import { Module, forwardRef } from "@nestjs/common";
import { SseController } from "./sse.controller.js";
import { AgentsModule } from "../../modules/agents/agents.module.js";

// forwardRef obligatorio: agents → browser-agent → evidence-gateway → sse →
// agents forma un ciclo ESM; la referencia directa a AgentsModule en el
// decorador crashea el boot con "Cannot access 'AgentsModule' before
// initialization" (visto en integration de la PR #303).
@Module({
  imports: [forwardRef(() => AgentsModule)],
  controllers: [SseController],
})
export class SseModule {}
