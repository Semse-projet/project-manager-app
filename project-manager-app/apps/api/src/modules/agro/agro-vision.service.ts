/**
 * Análisis de imagen para Agro (T-054), vía el vision-service ya existente
 * (`apps/vision-service`) — reusa `/v1/objects/recognize` (Sense Vision,
 * `docs/specs/vision/sense-vision-field-library.spec.md`), que ya soporta un
 * proveedor local (`VISION_OBJECT_PROVIDER=ollama`, modelo `qwen2.5vl:3b`):
 * ningún frame sale del perímetro cuando ese proveedor está activo. No se
 * construye un segundo pipeline — solo un vocabulario propio de Agro y un
 * wrapper best-effort (nunca bloquea el intake si el proveedor no está
 * configurado o falla).
 *
 * Deliberadamente NO se integra con `VisionLibraryService`/`UserDictionaryItem`
 * (Sense Vision completo: caché de librería en DB, "mi diccionario", Jev
 * Decision Gate) — eso es una feature de producto propia de construcción con
 * su propia UX; Agro solo necesita candidatos de objetos para enriquecer una
 * propuesta de intake, no un diccionario personal ni gamificación.
 */
import { Injectable, Logger } from "@nestjs/common";
import { VisionServiceClient } from "../vision/clients/vision-service.client.js";

// Vocabulario mínimo v1 (T-054) — no exhaustivo a propósito. Cubre las 3
// operationType de AgroFarm (LIVESTOCK/MIXED/CROP) con lo más común; ampliarlo
// es un cambio de datos, no de código.
export const AGRO_VISION_VOCABULARY: ReadonlyArray<{ slug: string; name: string }> = [
  { slug: "cow", name: "Cow" },
  { slug: "pig", name: "Pig" },
  { slug: "goat", name: "Goat" },
  { slug: "sheep", name: "Sheep" },
  { slug: "chicken", name: "Chicken" },
  { slug: "horse", name: "Horse" },
  { slug: "corral", name: "Pen / corral" },
  { slug: "water-trough", name: "Water trough" },
  { slug: "feed-trough", name: "Feed trough" },
  { slug: "fence", name: "Fence" },
  { slug: "tractor", name: "Tractor" },
  { slug: "silo", name: "Silo" },
  { slug: "greenhouse", name: "Greenhouse" },
  { slug: "irrigation-system", name: "Irrigation system" },
  { slug: "milking-equipment", name: "Milking equipment" },
];

export type AgroVisionCandidate = { slug: string | null; label: string | null; confidence: number };
export type AgroVisionResult = { provider: string; model: string; candidates: AgroVisionCandidate[] };

@Injectable()
export class AgroVisionService {
  private readonly logger = new Logger(AgroVisionService.name);

  constructor(private readonly client: VisionServiceClient) {}

  /**
   * Best-effort: nunca lanza. `null` cuando el proveedor no está configurado
   * (`VISION_OBJECT_PROVIDER` sin setear en vision-service — estado esperado,
   * no un error) o si la llamada falla (timeout, red, respuesta inesperada).
   */
  async recognize(imageUrl: string): Promise<AgroVisionResult | null> {
    try {
      const response = await this.client.recognizeObjects({ imageUrl, vocabulary: [...AGRO_VISION_VOCABULARY] });
      if (response.disabled) return null;
      return parseRecognizeBody(response.body);
    } catch (error) {
      this.logger.warn(`Agro vision recognition failed: ${(error as Error)?.message ?? String(error)}`);
      return null;
    }
  }
}

function parseRecognizeBody(body: unknown): AgroVisionResult | null {
  if (typeof body !== "object" || body === null) return null;
  const { provider, model, candidates } = body as Record<string, unknown>;
  if (typeof provider !== "string" || typeof model !== "string" || !Array.isArray(candidates)) return null;
  return {
    provider,
    model,
    candidates: candidates
      .filter((c): c is Record<string, unknown> => typeof c === "object" && c !== null)
      .map((c) => ({
        slug: typeof c.slug === "string" ? c.slug : null,
        label: typeof c.label === "string" ? c.label : null,
        confidence: typeof c.confidence === "number" ? c.confidence : 0,
      })),
  };
}
