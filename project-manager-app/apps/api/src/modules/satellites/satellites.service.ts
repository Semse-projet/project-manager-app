import crypto from "node:crypto";
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException
} from "@nestjs/common";
import { sha256 } from "../../common/auth-password.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

const TOKEN_PREFIX = "sst_";

export const SATELLITE_SCOPE_CATALOG = [
  "intake:read",
  "intake:write",
  "jobs:read",
  "jobs:write",
  "milestones:read",
  "knowledge:read",
  "uploads:driver",
  "tools:invoke",
  "events:subscribe"
] as const;

export type SatelliteScope = (typeof SATELLITE_SCOPE_CATALOG)[number];

export type SatelliteIdentity = {
  id: string;
  name: string;
  scopes: string[];
};

export function satelliteTokensEnabled(): boolean {
  return process.env.SATELLITE_TOKENS_ENABLED === "true";
}

@Injectable()
export class SatellitesService {
  private readonly logger = new Logger(SatellitesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async issueToken(input: { name: string; scopes: string[]; expiresAt?: string }) {
    const existing = await this.prisma.satelliteToken.findUnique({ where: { name: input.name } });
    if (existing && existing.status === "ACTIVE") {
      throw new ConflictException({
        message: `Satellite token '${input.name}' already exists — revoke it before issuing a new one`
      });
    }

    const rawToken = `${TOKEN_PREFIX}${crypto.randomBytes(32).toString("base64url")}`;
    const record = existing
      ? await this.prisma.satelliteToken.update({
          where: { id: existing.id },
          data: {
            tokenHash: sha256(rawToken),
            scopes: input.scopes,
            status: "ACTIVE",
            expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
            revokedAt: null,
            lastUsedAt: null
          }
        })
      : await this.prisma.satelliteToken.create({
          data: {
            name: input.name,
            tokenHash: sha256(rawToken),
            scopes: input.scopes,
            expiresAt: input.expiresAt ? new Date(input.expiresAt) : null
          }
        });

    this.logger.log(`Satellite token issued: ${record.name} scopes=[${input.scopes.join(",")}]`);

    // El token en claro solo existe en esta respuesta; en DB queda el hash.
    return {
      id: record.id,
      name: record.name,
      token: rawToken,
      scopes: record.scopes,
      createdAt: record.createdAt,
      expiresAt: record.expiresAt
    };
  }

  async listTokens() {
    const tokens = await this.prisma.satelliteToken.findMany({ orderBy: { createdAt: "asc" } });
    return tokens.map((token: {
      id: string;
      name: string;
      scopes: string[];
      status: string;
      expiresAt: Date | null;
      revokedAt: Date | null;
      lastUsedAt: Date | null;
      createdAt: Date;
    }) => ({
      id: token.id,
      name: token.name,
      scopes: token.scopes,
      status: token.status,
      expiresAt: token.expiresAt,
      revokedAt: token.revokedAt,
      lastUsedAt: token.lastUsedAt,
      createdAt: token.createdAt
    }));
  }

  async revokeToken(id: string) {
    const token = await this.prisma.satelliteToken.findUnique({ where: { id } });
    if (!token) {
      throw new NotFoundException({ message: `Satellite token '${id}' not found` });
    }

    const revoked = await this.prisma.satelliteToken.update({
      where: { id },
      data: { status: "REVOKED", revokedAt: new Date() }
    });

    this.logger.warn(`Satellite token revoked: ${revoked.name}`);
    return { id: revoked.id, name: revoked.name, status: revoked.status, revokedAt: revoked.revokedAt };
  }

  /**
   * Verifica un token satélite crudo. Lanza 503 con el kill switch apagado
   * (SAT-000 §2) y 401 para token desconocido, revocado o expirado.
   */
  async verifyToken(rawToken: string): Promise<SatelliteIdentity> {
    if (!satelliteTokensEnabled()) {
      throw new ServiceUnavailableException({
        message: "Satellite connectivity is disabled — SATELLITE_TOKENS_ENABLED is off"
      });
    }

    if (!rawToken.startsWith(TOKEN_PREFIX)) {
      throw new UnauthorizedException({ message: "Invalid satellite token" });
    }

    const record = await this.prisma.satelliteToken.findUnique({
      where: { tokenHash: sha256(rawToken) }
    });

    if (!record || record.status !== "ACTIVE") {
      throw new UnauthorizedException({ message: "Invalid satellite token" });
    }

    if (record.expiresAt && record.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException({ message: "Satellite token expired" });
    }

    // Heartbeat pasivo para Observer (SAT-008) — nunca bloquea la request.
    this.prisma.satelliteToken
      .update({ where: { id: record.id }, data: { lastUsedAt: new Date() } })
      .catch((err: unknown) => {
        this.logger.warn(`lastUsedAt update failed for ${record.name}: ${(err as Error)?.message ?? err}`);
      });

    return { id: record.id, name: record.name, scopes: record.scopes };
  }

  /**
   * Resuelve el canal declarado en x-semse-channel (SAT-002). Reclamar un
   * canal exige un satellite token valido con el scope requerido; sin header
   * devuelve null (canal por defecto del llamador, normalmente "web").
   */
  async resolveChannel(
    headers: Record<string, unknown>,
    requiredScope: string = "intake:write"
  ): Promise<string | null> {
    const rawChannel = headers["x-semse-channel"];
    if (typeof rawChannel !== "string" || !rawChannel.trim()) {
      return null;
    }

    const channel = rawChannel.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{0,29}$/.test(channel)) {
      throw new UnauthorizedException({ message: "Invalid x-semse-channel value" });
    }

    const authorization = headers.authorization;
    const token =
      typeof authorization === "string" && authorization.trim().toLowerCase().startsWith("bearer ")
        ? authorization.trim().slice(7).trim()
        : null;
    if (!token) {
      throw new UnauthorizedException({
        message: "Channel claims require a satellite token — 'Authorization: Bearer sst_...'"
      });
    }

    const satellite = await this.verifyToken(token);
    if (!satellite.scopes.includes(requiredScope)) {
      throw new ForbiddenException({
        message: "Satellite token lacks required scopes",
        required: [requiredScope],
        missing: [requiredScope]
      });
    }

    return channel;
  }
}
