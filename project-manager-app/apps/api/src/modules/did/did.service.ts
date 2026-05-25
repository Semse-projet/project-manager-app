import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { ReputationService } from "../ratings/reputation.service.js";
import type { DidDocument, DidResolutionResult } from "./did.types.js";

function apiBase(): string {
  return (process.env.SEMSE_API_BASE_URL ?? "http://localhost:4000").replace(/\/+$/, "");
}

export function toDid(userId: string): string {
  return `did:semse:${userId}`;
}

export function fromDid(did: string): string | null {
  const match = /^did:semse:(.+)$/.exec(did);
  return match?.[1] ?? null;
}

@Injectable()
export class DidService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reputationService: ReputationService,
  ) {}

  async resolve(userId: string, tenantId: string): Promise<DidResolutionResult> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, status: "active" },
      select: { id: true, verificationStatus: true, createdAt: true },
    });
    if (!user) throw new NotFoundException(`DID not found: did:semse:${userId}`);

    const reputation = await this.reputationService.computeForUser(tenantId, userId);

    const did = toDid(userId);
    const base = apiBase();
    const now = new Date().toISOString();

    const document: DidDocument = {
      "@context": [
        "https://www.w3.org/ns/did/v1",
        "https://w3id.org/security/suites/ed25519-2020/v1",
      ],
      id: did,
      controller: did,
      verificationMethod: [],
      authentication: [],
      service: [
        {
          id: `${did}#trust-passport`,
          type: "TrustPassportService",
          serviceEndpoint: `${base}/v1/trust-passport/verify`,
        },
        {
          id: `${did}#reputation`,
          type: "ReputationService",
          serviceEndpoint: `${base}/v1/users/${userId}/reputation`,
        },
        {
          id: `${did}#identity`,
          type: "SemseIdentityService",
          serviceEndpoint: `${base}/v1/did/${userId}`,
        },
      ],
      "semse:metadata": {
        verificationStatus: user.verificationStatus,
        reputationTier: reputation.tier,
        createdAt: user.createdAt.toISOString(),
        resolvedAt: now,
      },
    };

    return {
      "@context": "https://w3id.org/did-resolution/v1",
      didDocument: document,
      didResolutionMetadata: {
        contentType: "application/did+ld+json",
        retrieved: now,
      },
      didDocumentMetadata: {
        created: user.createdAt.toISOString(),
        method: "semse",
      },
    };
  }
}
