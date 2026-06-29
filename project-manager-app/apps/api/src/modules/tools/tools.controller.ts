import { Body, Controller, Get, NotFoundException, Param, Post, Req } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { ok } from "../../common/api-response.js";
import { AuthenticatedAccess } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { ToolsService, type ToolCalculateInput } from "./tools.service.js";
import { AlgorithmRunService } from "./algorithm-run.service.js";
import { LLMService } from "../../infrastructure/llm/llm.service.js";

type ToolCatalogEntry = { id: string; name: string; category: string; description: string };

const TOOL_CATALOG: ToolCatalogEntry[] = [
  { id: "electrical",     name: "Electrical",         category: "mechanical",  description: "Residential & commercial electrical work — panels, circuits, outlets, load calculations" },
  { id: "plumbing",       name: "Plumbing",            category: "mechanical",  description: "Fixtures, pipe sizing, water heaters, code compliance" },
  { id: "hvac",           name: "HVAC",                category: "mechanical",  description: "Load calculations, duct design, equipment sizing, permit requirements" },
  { id: "painting",       name: "Painting",            category: "finish",      description: "Interior/exterior painting — surface prep, coat counts, VOC compliance" },
  { id: "drywall",        name: "Drywall",             category: "finish",      description: "Drywall installation and finishing — waste factors, finish levels, texture" },
  { id: "tile",           name: "Tile",                category: "finish",      description: "Tile installation — substrate prep, waterproofing, grout joints" },
  { id: "flooring",       name: "Flooring",            category: "finish",      description: "Flooring installation — subfloor prep, waste factors, moisture barriers" },
  { id: "carpentry",      name: "Carpentry",           category: "finish",      description: "Finish carpentry — millwork, sequencing, material quantities" },
  { id: "bathroom",       name: "Bathroom Remodel",    category: "remodel",     description: "Full bathroom remodel — waterproofing, fixture rough-in, sequencing" },
  { id: "kitchen",        name: "Kitchen Remodel",     category: "remodel",     description: "Kitchen remodel — cabinetry, countertops, appliances, plumbing, electrical" },
  { id: "roofing",        name: "Roofing",             category: "exterior",    description: "Material quantities, underlayment, flashing, ventilation, warranty" },
  { id: "siding",         name: "Siding",              category: "exterior",    description: "Moisture barrier, trim details, material quantities" },
  { id: "windows-doors",  name: "Windows & Doors",     category: "exterior",    description: "Rough opening sizing, flashing, insulation, hardware, permit" },
  { id: "deck",           name: "Deck",                category: "exterior",    description: "Structural requirements, material choice, permit requirements" },
  { id: "fencing",        name: "Fencing",             category: "exterior",    description: "Post spacing, concrete footings, material quantities, permit" },
  { id: "landscaping",    name: "Landscaping",         category: "exterior",    description: "Plant material, grading, irrigation, drainage, seasonal timing" },
  { id: "solar",          name: "Solar",               category: "specialty",   description: "Panel layout, inverter sizing, interconnection, permit, incentive eligibility" },
  { id: "insulation",     name: "Insulation",          category: "specialty",   description: "R-value requirements, air sealing, vapor barriers, code compliance" },
  { id: "concrete",       name: "Concrete",            category: "structural",  description: "Mix design, reinforcement, forming, finishing, curing, weather" },
  { id: "masonry",        name: "Masonry",             category: "structural",  description: "Material quantities, mortar mix, scaffolding, structural considerations" },
  { id: "framing",        name: "Framing",             category: "structural",  description: "Lumber quantities, hardware, engineering requirements, sequencing" },
  { id: "demolition",     name: "Demolition",          category: "structural",  description: "Hazmat assessment, debris disposal, structural sequencing, permit" },
  { id: "cleaning",       name: "Cleaning",            category: "services",    description: "Scope coverage, frequency, crew sizing, chemical/equipment requirements" },
  { id: "labor",          name: "Labor",               category: "services",    description: "Crew sizing, productivity rates, overtime risk, subcontractor coordination" },
  { id: "project-manager", name: "Project Manager",   category: "services",    description: "Project scope, timeline, sequencing, risk exposure, trade coordination" },
];

type ToolInputSchema = { trade: string; requiredFields: string[]; optionalFields: string[]; notes: string };

const TOOL_INPUT_SCHEMAS: Record<string, ToolInputSchema> = {
  electrical:    { trade: "electrical",    requiredFields: ["sqft"],                    optionalFields: ["panels", "circuits", "outlets", "evChargers", "mode"], notes: "sqft is square footage of the space" },
  plumbing:      { trade: "plumbing",      requiredFields: ["fixtureCount"],            optionalFields: ["bathrooms", "kitchens", "waterHeater", "mode"], notes: "fixtureCount is total plumbing fixtures" },
  hvac:          { trade: "hvac",          requiredFields: ["sqft"],                    optionalFields: ["units", "ductwork", "zoneCount", "mode"], notes: "sqft drives load calculation" },
  painting:      { trade: "painting",      requiredFields: ["sqft"],                    optionalFields: ["stories", "coats", "ceilings", "exterior", "mode"], notes: "sqft is paintable surface area" },
  drywall:       { trade: "drywall",       requiredFields: ["sqft"],                    optionalFields: ["ceilings", "repairs", "finishLevel", "mode"], notes: "sqft is wall/ceiling area" },
  tile:          { trade: "tile",          requiredFields: ["sqft"],                    optionalFields: ["tileType", "groutType", "waterproofing", "mode"], notes: "sqft is tile coverage area" },
  flooring:      { trade: "flooring",      requiredFields: ["sqft"],                    optionalFields: ["flooringType", "subfloor", "stairs", "mode"], notes: "sqft is floor area" },
  carpentry:     { trade: "carpentry",     requiredFields: ["linearFt"],               optionalFields: ["complexity", "materialGrade", "mode"], notes: "linearFt is linear feet of trim/millwork" },
  bathroom:      { trade: "bathroom",      requiredFields: ["sqft"],                    optionalFields: ["fixtures", "tileWork", "custom", "mode"], notes: "sqft is bathroom floor area" },
  kitchen:       { trade: "kitchen",       requiredFields: ["sqft"],                    optionalFields: ["cabinets", "countertops", "appliances", "island", "mode"], notes: "sqft is kitchen area" },
  roofing:       { trade: "roofing",       requiredFields: ["sqft"],                    optionalFields: ["layers", "material", "pitch", "mode"], notes: "sqft is roof deck area" },
  siding:        { trade: "siding",        requiredFields: ["sqft"],                    optionalFields: ["material", "stories", "trim", "mode"], notes: "sqft is exterior wall area" },
  "windows-doors": { trade: "windows-doors", requiredFields: ["units"],               optionalFields: ["windowSize", "doorCount", "premium", "mode"], notes: "units is count of windows+doors" },
  deck:          { trade: "deck",          requiredFields: ["sqft"],                    optionalFields: ["material", "stories", "railings", "mode"], notes: "sqft is deck surface area" },
  fencing:       { trade: "fencing",       requiredFields: ["linearFt"],               optionalFields: ["material", "height", "gates", "mode"], notes: "linearFt is fence perimeter" },
  landscaping:   { trade: "landscaping",   requiredFields: ["sqft"],                    optionalFields: ["irrigation", "hardscape", "plantingDensity", "mode"], notes: "sqft is landscape area" },
  solar:         { trade: "solar",         requiredFields: ["kw"],                      optionalFields: ["panels", "battery", "roofType", "mode"], notes: "kw is system size in kilowatts" },
  insulation:    { trade: "insulation",    requiredFields: ["sqft"],                    optionalFields: ["rValue", "type", "attic", "walls", "mode"], notes: "sqft is insulation coverage area" },
  concrete:      { trade: "concrete",      requiredFields: ["sqft"],                    optionalFields: ["depth", "reinforcement", "finish", "mode"], notes: "sqft is slab area" },
  masonry:       { trade: "masonry",       requiredFields: ["sqft"],                    optionalFields: ["material", "pattern", "mortar", "mode"], notes: "sqft is masonry surface area" },
  framing:       { trade: "framing",       requiredFields: ["sqft"],                    optionalFields: ["stories", "complexity", "lumberGrade", "mode"], notes: "sqft is framed area" },
  demolition:    { trade: "demolition",    requiredFields: ["sqft"],                    optionalFields: ["hazmat", "structural", "dumpsters", "mode"], notes: "sqft is area to be demolished" },
  cleaning:      { trade: "cleaning",      requiredFields: ["sqft"],                    optionalFields: ["frequency", "type", "specialized", "mode"], notes: "sqft is area to be cleaned" },
  labor:         { trade: "labor",         requiredFields: ["hours"],                   optionalFields: ["crewSize", "skilled", "overtime", "mode"], notes: "hours is total labor hours" },
  "project-manager": { trade: "project-manager", requiredFields: ["totalBudget"],     optionalFields: ["duration", "tradeCount", "complexity", "mode"], notes: "totalBudget drives PM cost estimate" },
};

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
@AuthenticatedAccess("Authenticated pro tools surface pending granular tools permissions.")
export class ToolsController {
  constructor(
    private readonly toolsService: ToolsService,
    private readonly algorithmRunService: AlgorithmRunService,
    private readonly llm: LLMService,
  ) {}

  @Get("catalog")
  getCatalog(@Req() req: FastifyRequest) {
    const rid = resolveRequestId(req.headers ?? {});
    return ok(rid, TOOL_CATALOG);
  }

  @Get("schema/:trade")
  getSchema(@Req() req: FastifyRequest, @Param("trade") trade: string) {
    const rid = resolveRequestId(req.headers ?? {});
    const schema = TOOL_INPUT_SCHEMAS[trade.toLowerCase()];
    if (!schema) throw new NotFoundException(`No schema for trade '${trade}'`);
    return ok(rid, schema);
  }

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
