import { Injectable, Logger } from "@nestjs/common";
import { AiModelGatewayService } from "../ai-models/gateway/ai-model-gateway.service.js";
import { FinanceService } from "../finance/finance.service.js";
import { ContractorService } from "./contractor.service.js";
import type { InvoiceLineItem } from "../finance/finance.repository.js";

export type SuggestedLineItem = {
  description: string;
  qty: number;
  unitPrice: number;
  taxRate: number;
  total: number;
  category: "materials" | "labor" | "other";
};

export type SuggestEstimateInput = {
  tenantId: string;
  leadId: string;
  userId: string;
};

export type CreateEstimateFromLeadInput = {
  tenantId: string;
  orgId: string;
  userId: string;
  leadId: string;
  lineItems: InvoiceLineItem[];
  dueDate?: string;
  notes?: string;
  terms?: string;
};

const DEFAULT_TERMS = "50% de depósito requerido para iniciar el trabajo. Saldo al terminar y antes de la entrega final. Precios válidos por 14 días.";

@Injectable()
export class ContractorEstimateService {
  private readonly logger = new Logger(ContractorEstimateService.name);

  constructor(
    private readonly gateway: AiModelGatewayService,
    private readonly finance: FinanceService,
    private readonly contractor: ContractorService,
  ) {}

  async suggestLineItems(input: SuggestEstimateInput): Promise<SuggestedLineItem[]> {
    const lead = await this.contractor.getLead(input.leadId, input.tenantId);

    const prompt = `Eres un experto en construcción en los Estados Unidos. Crea una lista de items para un estimado profesional.

TRABAJO SOLICITADO:
- Tipo: ${lead.jobType ?? "trabajo general de construcción"}
- Descripción: ${lead.description ?? "trabajo de reparación/remodelación"}
- Presupuesto del cliente: ${lead.budgetRange ?? "no especificado"}
- Área aproximada: no especificada (usa dimensiones típicas)

INSTRUCCIONES:
Genera un JSON con un array de objetos. Cada objeto tiene exactamente estos campos:
{
  "description": "descripción clara del item",
  "qty": número,
  "unitPrice": precio en USD,
  "taxRate": 0,
  "total": qty * unitPrice,
  "category": "materials" | "labor" | "other"
}

REGLAS:
- Incluye 2-5 items de materiales y 1-2 de mano de obra
- Precios realistas en USD para mercado de EE.UU. (2024-2025)
- Incluye 10% de materiales extra para desperdicio
- Mano de obra separada de materiales
- Total de la lista entre $300 y $5,000 salvo que el trabajo claramente requiera más
- Responde SOLO el array JSON, sin texto adicional, sin markdown, sin explicación

Ejemplo de formato:
[{"description":"Drywall 4x8 sheets","qty":10,"unitPrice":14.99,"taxRate":0,"total":149.90,"category":"materials"},{"description":"Joint compound 5-gal bucket","qty":2,"unitPrice":22.50,"taxRate":0,"total":45.00,"category":"materials"},{"description":"Labor - drywall installation","qty":1,"unitPrice":350,"taxRate":0,"total":350,"category":"labor"}]`;

    const response = await this.gateway.generate({
      agentId: "assistant",
      userId: input.userId,
      taskType: "estimate_review",
      input: prompt,
      systemPrompt: "Eres un asistente de estimados de construcción. Responde SOLO con JSON válido, sin markdown ni texto adicional.",
    });

    if (!response.success) {
      this.logger.warn(`[suggest-estimate] gateway failed for lead ${input.leadId}: ${response.errorMessage}`);
      return this.fallbackLineItems(lead.jobType, lead.description);
    }

    try {
      const raw = response.output.trim().replace(/^```json\n?/, "").replace(/\n?```$/, "").trim();
      const parsed = JSON.parse(raw) as SuggestedLineItem[];
      if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("Empty array");
      return parsed.map((item) => ({
        description: String(item.description ?? ""),
        qty: Number(item.qty) || 1,
        unitPrice: Number(item.unitPrice) || 0,
        taxRate: 0,
        total: Number(item.total) || (Number(item.qty) || 1) * (Number(item.unitPrice) || 0),
        category: (["materials", "labor", "other"].includes(item.category) ? item.category : "other") as SuggestedLineItem["category"],
      }));
    } catch (err) {
      this.logger.warn(`[suggest-estimate] JSON parse failed for lead ${input.leadId}: ${String(err)}`);
      return this.fallbackLineItems(lead.jobType, lead.description);
    }
  }

  async createEstimateFromLead(input: CreateEstimateFromLeadInput) {
    const lead = await this.contractor.getLead(input.leadId, input.tenantId);

    const lineItems: InvoiceLineItem[] = input.lineItems.map((item) => ({
      description: item.description,
      qty: item.qty,
      unitPrice: item.unitPrice,
      taxRate: item.taxRate ?? 0,
      total: item.total,
    }));

    const title = `Estimado — ${lead.jobType ?? "Trabajo de construcción"} — ${lead.name}`;

    const invoice = await this.finance.createInvoice({
      tenantId: input.tenantId,
      orgId: input.orgId,
      createdBy: input.userId,
      clientOrgId: lead.name,
      title,
      lineItems,
      dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
      notes: input.notes ?? `Cliente: ${lead.name}${lead.phone ? ` · Tel: ${lead.phone}` : ""}${lead.address ? ` · ${lead.address}` : ""}`,
      terms: input.terms ?? DEFAULT_TERMS,
    });

    await this.contractor.updateLead(input.leadId, input.tenantId, {
      status: "estimate_sent",
      nextAction: "Dar seguimiento al estimado enviado",
    });

    return invoice;
  }

  private fallbackLineItems(jobType?: string | null, description?: string | null): SuggestedLineItem[] {
    const job = (jobType ?? description ?? "general").toLowerCase();
    if (job.includes("drywall") || job.includes("sheet")) {
      return [
        { description: "Drywall 4x8 sheets (includes 10% waste)", qty: 12, unitPrice: 14.99, taxRate: 0, total: 179.88, category: "materials" },
        { description: "Joint compound 5-gal bucket", qty: 2, unitPrice: 22.50, taxRate: 0, total: 45.00, category: "materials" },
        { description: "Drywall screws 5lb box", qty: 1, unitPrice: 18.00, taxRate: 0, total: 18.00, category: "materials" },
        { description: "Labor — drywall installation and finishing", qty: 1, unitPrice: 450, taxRate: 0, total: 450, category: "labor" },
      ];
    }
    if (job.includes("pint") || job.includes("paint")) {
      return [
        { description: "Interior paint — 1 gal (covers ~400 sqft)", qty: 3, unitPrice: 45.00, taxRate: 0, total: 135.00, category: "materials" },
        { description: "Primer 1 gal", qty: 1, unitPrice: 32.00, taxRate: 0, total: 32.00, category: "materials" },
        { description: "Painter tape, drop cloth, rollers, brushes", qty: 1, unitPrice: 55.00, taxRate: 0, total: 55.00, category: "materials" },
        { description: "Labor — surface prep and painting", qty: 1, unitPrice: 380, taxRate: 0, total: 380, category: "labor" },
      ];
    }
    if (job.includes("piso") || job.includes("floor") || job.includes("tile") || job.includes("vinyl")) {
      return [
        { description: "LVP flooring planks (sqft)", qty: 150, unitPrice: 2.50, taxRate: 0, total: 375.00, category: "materials" },
        { description: "Underlayment roll", qty: 1, unitPrice: 45.00, taxRate: 0, total: 45.00, category: "materials" },
        { description: "Transition strips and trim", qty: 1, unitPrice: 65.00, taxRate: 0, total: 65.00, category: "materials" },
        { description: "Labor — floor installation", qty: 1, unitPrice: 400, taxRate: 0, total: 400, category: "labor" },
      ];
    }
    return [
      { description: "Materials and supplies", qty: 1, unitPrice: 250, taxRate: 0, total: 250, category: "materials" },
      { description: "Labor", qty: 1, unitPrice: 400, taxRate: 0, total: 400, category: "labor" },
      { description: "Miscellaneous / overhead (10%)", qty: 1, unitPrice: 65, taxRate: 0, total: 65, category: "other" },
    ];
  }
}
