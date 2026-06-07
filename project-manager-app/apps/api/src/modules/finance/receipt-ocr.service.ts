import { Injectable, Logger } from "@nestjs/common";
import { AiModelGatewayService } from "../ai-models/gateway/ai-model-gateway.service.js";

export type ExtractedReceipt = {
  vendor: string | null;
  amount: number | null;
  currency: string;
  date: string | null;
  category: string;
  description: string;
  taxAmount: number | null;
  paymentMethod: string | null;
  receiptNumber: string | null;
  lineItems: Array<{ description: string; amount: number }>;
  confidence: "high" | "medium" | "low";
  rawText: string;
};

const SYSTEM_PROMPT = `Eres un extractor de datos de recibos y facturas para la plataforma SEMSE.
Tu tarea es analizar el texto de un recibo y extraer datos estructurados en JSON.

Responde SIEMPRE con un objeto JSON válido con estos campos:
{
  "vendor": string | null,           // nombre del proveedor/tienda
  "amount": number | null,           // monto total (solo número, sin símbolo)
  "currency": "USD" | "MXN" | string, // moneda detectada
  "date": "YYYY-MM-DD" | null,       // fecha del recibo
  "category": string,                // una de: materials, labor, tools, transport, permits, subcontractors, maintenance, equipment, unexpected, other
  "description": string,             // descripción breve del gasto (máx 100 chars)
  "taxAmount": number | null,        // monto de impuesto si aparece
  "paymentMethod": string | null,    // efectivo, tarjeta, transferencia, etc.
  "receiptNumber": string | null,    // número de recibo si aparece
  "lineItems": [                     // artículos individuales si los hay
    { "description": string, "amount": number }
  ],
  "confidence": "high" | "medium" | "low"  // qué tan seguro estás de los datos
}

Reglas:
- Si no puedes determinar un campo, usa null.
- El campo "category" debe ser uno de los valores listados.
- "confidence" es "high" si el texto es claro, "medium" si hay ambigüedad, "low" si el texto es ilegible o incompleto.
- No incluyas texto fuera del JSON.`;

@Injectable()
export class ReceiptOcrService {
  private readonly logger = new Logger(ReceiptOcrService.name);

  constructor(private readonly gateway: AiModelGatewayService) {}

  async extractFromReceipt(input: {
    tenantId: string;
    userId: string;
    receiptText?: string;
    receiptUrl?: string;
    hint?: string;
  }): Promise<ExtractedReceipt> {
    const rawText = input.receiptText?.trim() ?? "";

    if (!rawText && !input.receiptUrl) {
      return this.emptyExtraction("Sin texto ni URL de recibo proporcionados.");
    }

    const userContent = [
      rawText ? `Texto del recibo:\n${rawText}` : "",
      input.receiptUrl ? `URL del recibo: ${input.receiptUrl}` : "",
      input.hint ? `Contexto adicional: ${input.hint}` : "",
    ].filter(Boolean).join("\n\n");

    try {
      const response = await this.gateway.generate({
        agentId: "finance-ocr",
        userId: input.userId,
        taskType: "receipt_ocr",
        systemPrompt: SYSTEM_PROMPT,
        input: userContent,
        requireJson: true,
        temperature: 0,
        metadata: { tenantId: input.tenantId },
      });

      if (!response.success || !response.output) {
        this.logger.warn(`[ocr] generation failed: ${response.errorMessage}`);
        return this.emptyExtraction(response.errorMessage ?? "Error de generación");
      }

      const parsed = this.parseJson(response.output);
      if (!parsed) {
        this.logger.warn("[ocr] failed to parse JSON from LLM output");
        return this.emptyExtraction("No se pudo parsear la respuesta del modelo");
      }

      this.logger.log(`[ocr] extracted vendor=${parsed.vendor} amount=${parsed.amount} confidence=${parsed.confidence}`);

      const str = (v: unknown) => (v != null ? String(v) : null);
      return {
        vendor: str(parsed.vendor),
        amount: typeof parsed.amount === "number" ? parsed.amount : null,
        currency: String(parsed.currency ?? "USD"),
        date: str(parsed.date),
        category: this.normalizeCategory(String(parsed.category ?? "other")),
        description: String(parsed.description ?? "").slice(0, 200),
        taxAmount: typeof parsed.taxAmount === "number" ? parsed.taxAmount : null,
        paymentMethod: str(parsed.paymentMethod),
        receiptNumber: str(parsed.receiptNumber),
        lineItems: Array.isArray(parsed.lineItems) ? parsed.lineItems as ExtractedReceipt["lineItems"] : [],
        confidence: (["high", "medium", "low"].includes(String(parsed.confidence)) ? parsed.confidence : "low") as ExtractedReceipt["confidence"],
        rawText,
      };
    } catch (err) {
      this.logger.error(`[ocr] error: ${String(err)}`);
      return this.emptyExtraction(String(err));
    }
  }

  private normalizeCategory(raw: string): string {
    const valid = ["materials", "labor", "tools", "transport", "permits", "subcontractors", "maintenance", "equipment", "unexpected", "other"];
    return valid.includes(raw.toLowerCase()) ? raw.toLowerCase() : "other";
  }

  private parseJson(text: string): Record<string, unknown> | null {
    const cleaned = text.trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    try {
      return JSON.parse(cleaned) as Record<string, unknown>;
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) {
        try { return JSON.parse(match[0]) as Record<string, unknown>; } catch { /* fall through */ }
      }
      return null;
    }
  }

  private emptyExtraction(reason: string): ExtractedReceipt {
    return {
      vendor: null, amount: null, currency: "USD", date: null,
      category: "other", description: reason.slice(0, 100),
      taxAmount: null, paymentMethod: null, receiptNumber: null,
      lineItems: [], confidence: "low", rawText: "",
    };
  }
}
