import { BadRequestException, ConflictException, ForbiddenException, Injectable } from "@nestjs/common";
import { createAiModelPriceSchema } from "@semse/schemas";
import { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import {
  computeCost,
  resolvePrice,
  validatePriceMetadata,
  type CostResult,
  type PriceEntry,
  type PriceKey,
  type Usage,
} from "./ai-pricing-catalog.js";

export type PricingActor = { tenantId: string; userId: string; roles: string[] };

type PriceRow = {
  id: string; provider: string; modelSlug: string; providerModelName: string;
  inputPer1K: { toNumber(): number }; outputPer1K: { toNumber(): number };
  currency: string; effectiveFrom: Date; effectiveTo: Date | null;
  pricingSchemaVersion: number; metadataJson: unknown;
  sourceUrl: string; sourcePublishedAt: Date | null; sourceCheckedAt: Date; createdBy: string; createdAt: Date;
};

const toEntry = (r: PriceRow): PriceEntry => ({
  id: r.id, provider: r.provider, modelSlug: r.modelSlug, providerModelName: r.providerModelName,
  inputPer1K: r.inputPer1K.toNumber(), outputPer1K: r.outputPer1K.toNumber(), currency: "USD",
  effectiveFrom: r.effectiveFrom, effectiveTo: r.effectiveTo,
  pricingSchemaVersion: r.pricingSchemaVersion,
  metadataJson: (r.metadataJson && typeof r.metadataJson === "object" ? r.metadataJson : {}) as Record<string, unknown>,
});

const CLOCK_SKEW_MS = 5 * 60_000;

/**
 * C39 — catálogo GLOBAL de plataforma (excepción autorizada a tenantId, solo AiModelPrice).
 * Escritura solo OPS_ADMIN y auditada; las entradas son inmutables (la base lo impone con
 * exclusión de intervalos, CHECKs y triggers). Lectura/resolución para el logger de IA.
 */
@Injectable()
export class AiPricingCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  /** Entrada vigente en `at` para la clave tarifaria (provider + slug + nombre real del modelo). */
  async findEffective(key: PriceKey, at: Date): Promise<PriceEntry | undefined> {
    const rows: PriceRow[] = await this.prisma.aiModelPrice.findMany({
      where: {
        provider: key.provider, modelSlug: key.modelSlug, providerModelName: key.providerModelName,
        effectiveFrom: { lte: at }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
      },
      orderBy: { effectiveFrom: "desc" },
      take: 2,
    });
    return resolvePrice(rows.map(toEntry), key, at);
  }

  /** Costo con el precio vigente en `at`. Sin entrada ⇒ unknown (nunca $0). */
  async resolveCost(key: PriceKey, at: Date, usage: Usage): Promise<CostResult> {
    return computeCost(await this.findEffective(key, at), usage);
  }

  async list(filter: { provider?: string; modelSlug?: string; providerModelName?: string } = {}) {
    const rows: PriceRow[] = await this.prisma.aiModelPrice.findMany({
      where: { ...filter },
      orderBy: [{ provider: "asc" }, { modelSlug: "asc" }, { providerModelName: "asc" }, { effectiveFrom: "desc" }],
      take: 500,
    });
    return rows.map((r) => ({ ...toEntry(r), sourceUrl: r.sourceUrl, sourcePublishedAt: r.sourcePublishedAt, sourceCheckedAt: r.sourceCheckedAt, createdBy: r.createdBy, createdAt: r.createdAt }));
  }

  /**
   * Alta de una vigencia. Si existe una vigencia abierta de la misma clave, se cierra en
   * `effectiveFrom` dentro de la MISMA transacción (con advisory lock por clave para
   * serializar altas concurrentes). Un solape con otra vigencia lo rechaza la base (23P01).
   */
  async createPrice(actor: PricingActor, body: unknown) {
    if (!actor.roles.includes("OPS_ADMIN")) {
      throw new ForbiddenException("solo OPS_ADMIN puede cargar precios del catálogo");
    }
    const parsed = createAiModelPriceSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ message: "precio inválido", issues: parsed.error.issues });
    }
    const input = parsed.data;
    const meta = validatePriceMetadata(input.pricingSchemaVersion, input.metadataJson);
    if (!meta.ok) throw new BadRequestException(meta.reason);

    const effectiveFrom = new Date(input.effectiveFrom);
    const effectiveTo = input.effectiveTo ? new Date(input.effectiveTo) : null;
    const sourceCheckedAt = new Date(input.sourceCheckedAt);
    const sourcePublishedAt = input.sourcePublishedAt ? new Date(input.sourcePublishedAt) : null;
    if (effectiveTo && effectiveTo <= effectiveFrom) throw new BadRequestException("effectiveTo debe ser posterior a effectiveFrom");
    if (sourceCheckedAt.getTime() > Date.now() + CLOCK_SKEW_MS) throw new BadRequestException("sourceCheckedAt no puede estar en el futuro");
    if (sourcePublishedAt && sourcePublishedAt > sourceCheckedAt) throw new BadRequestException("sourcePublishedAt no puede ser posterior a sourceCheckedAt");

    const lockKey = `${input.provider}|${input.modelSlug}|${input.providerModelName}`;
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
        const open: PriceRow | null = await tx.aiModelPrice.findFirst({
          where: { provider: input.provider, modelSlug: input.modelSlug, providerModelName: input.providerModelName, effectiveTo: null },
        });
        if (open) {
          if (effectiveFrom <= open.effectiveFrom) {
            throw new ConflictException("effectiveFrom debe ser posterior al inicio de la vigencia abierta actual");
          }
          await tx.aiModelPrice.update({ where: { id: open.id }, data: { effectiveTo: effectiveFrom } });
        }
        const created: PriceRow = await tx.aiModelPrice.create({
          data: {
            provider: input.provider, modelSlug: input.modelSlug, providerModelName: input.providerModelName,
            inputPer1K: input.inputPer1K, outputPer1K: input.outputPer1K, currency: "USD",
            effectiveFrom, effectiveTo, pricingSchemaVersion: input.pricingSchemaVersion,
            metadataJson: input.metadataJson as never,
            sourceUrl: input.sourceUrl, sourcePublishedAt, sourceCheckedAt, createdBy: actor.userId,
          },
        });
        await tx.auditLog.create({
          data: {
            tenantId: actor.tenantId, actorUserId: actor.userId, entityType: "AiModelPrice", entityId: created.id,
            action: "ai_pricing.price_created",
            beforeJson: open ? { closedPriceId: open.id, effectiveTo: effectiveFrom.toISOString() } : undefined,
            afterJson: {
              provider: created.provider, modelSlug: created.modelSlug, providerModelName: created.providerModelName,
              inputPer1K: input.inputPer1K, outputPer1K: input.outputPer1K, effectiveFrom: effectiveFrom.toISOString(),
              effectiveTo: effectiveTo?.toISOString() ?? null, pricingSchemaVersion: input.pricingSchemaVersion,
              sourceUrl: input.sourceUrl, sourceCheckedAt: sourceCheckedAt.toISOString(),
            },
          },
        });
        return { ...toEntry(created), sourceUrl: created.sourceUrl, sourceCheckedAt: created.sourceCheckedAt, createdBy: created.createdBy };
      });
    } catch (err) {
      if (err instanceof ConflictException || err instanceof BadRequestException) throw err;
      const msg = String((err as { message?: string })?.message ?? err);
      if (msg.includes("AiModelPrice_no_overlap") || msg.includes("23P01") || msg.includes("exclusion constraint")) {
        throw new ConflictException("la vigencia se solapa con otra entrada de la misma clave tarifaria");
      }
      throw err;
    }
  }
}
