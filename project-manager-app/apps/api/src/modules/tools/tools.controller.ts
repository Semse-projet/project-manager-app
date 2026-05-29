import { Body, Controller, Post, Req } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { ok } from "../../common/api-response.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { ToolsService, type ToolCalculateInput } from "./tools.service.js";
import { AlgorithmRunService } from "./algorithm-run.service.js";
import { LLMService } from "../../infrastructure/llm/llm.service.js";

const TRADE_SYSTEM_PROMPTS: Record<string, string> = {
  electrical: "You are a licensed electrical contractor and estimating expert. Analyze the provided estimate and answer questions about scope, code compliance (NEC/NFPA 70), material selection, load calculations, permit requirements, and risk. Be concise and specific.",
  drywall: "You are a drywall and finishing expert. Analyze estimates for scope accuracy, waste factors, finish levels, texture matching, and scheduling. Identify scope gaps and cost risks.",
  painting: "You are a professional painting contractor. Review estimates for surface prep requirements, coat counts, VOC compliance, weather windows, and material quantities. Flag hidden costs.",
  bathroom: "You are a bathroom remodel specialist. Analyze estimates for waterproofing, fixture rough-in, tile layout, ventilation, permit requirements, and sequencing risks.",
  kitchen: "You are a kitchen remodel expert. Review estimates for cabinetry, countertop, appliance, plumbing, electrical, and permit requirements. Flag change-order triggers.",
  plumbing: "You are a licensed plumber. Analyze estimates for fixture counts, pipe sizing, permit requirements, water heater specs, and code compliance. Identify scope risks.",
  hvac: "You are an HVAC contractor. Review estimates for load calculations, equipment sizing, duct design, permit requirements, and energy efficiency. Flag oversizing or undersizing risks.",
  roofing: "You are a roofing contractor. Analyze estimates for material quantities, underlayment, flashing, ventilation, warranty requirements, and weather risk windows.",
  flooring: "You are a flooring installation expert. Review estimates for subfloor prep, acclimation, transition strips, waste factors, and moisture barriers.",
  tile: "You are a tile installation specialist. Analyze estimates for substrate prep, waterproofing, grout joints, material waste, and scheduling for curing time.",
  concrete: "You are a concrete contractor. Review estimates for mix design, reinforcement, forming, finishing, curing, and weather requirements.",
  masonry: "You are a masonry expert. Analyze estimates for material quantities, mortar mix, weather requirements, scaffolding, and structural considerations.",
  framing: "You are a framing contractor. Review estimates for lumber quantities, hardware, engineering requirements, and sequencing with other trades.",
  demolition: "You are a demolition contractor. Analyze estimates for hazmat assessment, debris disposal, structural sequencing, and permit requirements.",
  landscaping: "You are a landscaping contractor. Review estimates for plant material, grading, irrigation, drainage, and seasonal timing risks.",
  fencing: "You are a fencing contractor. Analyze estimates for post spacing, concrete footings, material quantities, and permit requirements.",
  deck: "You are a deck building expert. Review estimates for structural requirements, material choice, permit requirements, and weather exposure.",
  insulation: "You are an insulation expert. Analyze estimates for R-value requirements, air sealing, vapor barriers, and code compliance.",
  solar: "You are a solar installation expert. Review estimates for panel layout, inverter sizing, interconnection, permit requirements, and incentive eligibility.",
  siding: "You are a siding contractor. Analyze estimates for moisture barrier, trim details, material quantities, and weather exposure.",
  carpentry: "You are a finish carpentry expert. Review estimates for material quantities, complexity, sequencing after paint, and millwork details.",
  cleaning: "You are a professional cleaning operations expert. Analyze estimates for scope coverage, frequency, crew sizing, and chemical/equipment requirements.",
  "project-manager": "You are a construction project manager. Review the project scope, timeline, sequencing, risk exposure, and coordination requirements across trades.",
  labor: "You are a construction labor cost expert. Analyze crew sizing, productivity rates, overtime risk, and subcontractor coordination.",
  windows: "You are a windows and doors installation expert. Review estimates for rough opening sizing, flashing, insulation, hardware, and permit requirements.",
  "windows-doors": "You are a windows and doors installation expert. Review estimates for rough opening sizing, flashing, insulation, hardware, and permit requirements.",
};

function buildSystemPrompt(trade: string): string {
  return (
    TRADE_SYSTEM_PROMPTS[trade] ??
    `You are a professional construction contractor specializing in ${trade}. Analyze the estimate and answer questions accurately and concisely.`
  );
}

@Controller("v1/tools")
export class ToolsController {
  constructor(
    private readonly toolsService: ToolsService,
    private readonly algorithmRunService: AlgorithmRunService,
    private readonly llm: LLMService,
  ) {}

  @Post("calculate")
  calculate(@Req() req: FastifyRequest, @Body() body: ToolCalculateInput) {
    const rid    = resolveRequestId(req.headers ?? {});
    const result = this.toolsService.calculate(body);

    // Record algorithm run asynchronously — never blocks response
    void (async () => {
      try {
        const actor = resolveRequestContext(req as Parameters<typeof resolveRequestContext>[0]);
        await this.algorithmRunService.record(body.tool, body.input ?? {}, result, {
          tenantId: actor.tenantId,
          userId:   actor.userId,
        });
      } catch { /* swallowed */ }
    })();

    return ok(rid, result);
  }

  @Post("quote")
  quote(@Req() req: FastifyRequest, @Body() body: { result: Record<string, unknown> }) {
    const rid = resolveRequestId(req.headers ?? {});
    const result = this.toolsService.quote(body.result as never);
    return ok(rid, result);
  }

  @Post("milestones")
  milestones(@Req() req: FastifyRequest, @Body() body: { result: Record<string, unknown> }) {
    const rid = resolveRequestId(req.headers ?? {});
    const result = this.toolsService.milestones(body.result as never);
    return ok(rid, result);
  }

  @Post("evidence")
  evidence(@Req() req: FastifyRequest, @Body() body: { result: Record<string, unknown> }) {
    const rid = resolveRequestId(req.headers ?? {});
    const result = this.toolsService.evidence(body.result as never);
    return ok(rid, result);
  }

  @Post("export")
  export(@Req() req: FastifyRequest, @Body() body: { result: Record<string, unknown> }) {
    const rid = resolveRequestId(req.headers ?? {});
    const result = this.toolsService.export(body.result as never);
    return ok(rid, result);
  }

  @Post("escrow")
  escrow(@Req() req: FastifyRequest, @Body() body: { result: Record<string, unknown> }) {
    const rid = resolveRequestId(req.headers ?? {});
    const result = this.toolsService.escrow(body.result as never);
    return ok(rid, result);
  }

  @Post("change-order")
  changeOrder(@Req() req: FastifyRequest, @Body() body: { result: Record<string, unknown>; deltaPercent: number }) {
    const rid = resolveRequestId(req.headers ?? {});
    const result = this.toolsService.changeOrder(body.result as never, body.deltaPercent ?? 0);
    return ok(rid, result);
  }

  @Post("dispute-risk")
  disputeRisk(@Req() req: FastifyRequest, @Body() body: { result: Record<string, unknown> }) {
    const rid = resolveRequestId(req.headers ?? {});
    const result = this.toolsService.disputeRisk(body.result as never);
    return ok(rid, result);
  }

  @Post("ai-assist")
  async aiAssist(
    @Req() req: FastifyRequest,
    @Body() body: { trade: string; question: string; context?: Record<string, unknown> },
  ) {
    const rid = resolveRequestId(req.headers ?? {});
    const trade = typeof body.trade === "string" ? body.trade.trim() : "general";
    const question = typeof body.question === "string" ? body.question.trim() : "";
    if (!question) {
      return ok(rid, { answer: "", provider: "none", trade });
    }

    const systemPrompt = buildSystemPrompt(trade);

    const contextBlock = body.context
      ? `\n\nCurrent estimate context:\n${JSON.stringify(body.context, null, 2)}`
      : "";

    const res = await this.llm.chat({
      systemPrompt,
      history: [],
      userMessage: question + contextBlock,
      maxTokens: 512,
    });

    return ok(rid, {
      answer: res.text,
      provider: res.provider ?? "unknown",
      model: res.model,
      trade,
    });
  }
}
