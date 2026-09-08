import crypto from "node:crypto";
import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import type { LiveSessionMediaTokenView } from "@semse/schemas";

/**
 * Firma de tokens de participante de LiveKit — ADR-026.
 *
 * Un access token de LiveKit es un JWT HS256 firmado con `LIVEKIT_API_SECRET`,
 * con `iss = LIVEKIT_API_KEY` y un claim `video` con los grants del room. Se
 * implementa a mano (sin `livekit-server-sdk`) para no agregar la dependencia
 * antes de que el propietario decida el modo de despliegue. El token es
 * efímero (TTL ≤ vida de la sesión) y **nunca** se loguea ni se persiste.
 */
@Injectable()
export class LiveKitService {
  private readonly url = process.env.LIVEKIT_URL ?? "";
  private readonly apiKey = process.env.LIVEKIT_API_KEY ?? "";
  private readonly apiSecret = process.env.LIVEKIT_API_SECRET ?? "";

  get configured(): boolean {
    return this.url !== "" && this.apiKey !== "" && this.apiSecret !== "";
  }

  roomName(tenantId: string, sessionId: string): string {
    return `live-session:${tenantId}:${sessionId}`;
  }

  createParticipantToken(params: {
    tenantId: string;
    sessionId: string;
    userId: string;
    ttlSeconds: number;
  }): LiveSessionMediaTokenView {
    if (!this.configured) {
      throw new ServiceUnavailableException("LiveKit is not configured (LIVEKIT_URL/API_KEY/API_SECRET)");
    }
    const now = Math.floor(Date.now() / 1000);
    const ttl = Math.max(60, Math.min(params.ttlSeconds, 6 * 60 * 60));
    const room = this.roomName(params.tenantId, params.sessionId);
    const payload = {
      iss: this.apiKey,
      sub: params.userId,
      nbf: now,
      exp: now + ttl,
      name: params.userId,
      video: {
        room,
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      },
    };
    const token = this.signHs256(payload);
    return {
      token,
      url: this.url,
      room,
      expiresAt: new Date((now + ttl) * 1000).toISOString(),
    };
  }

  private signHs256(payload: Record<string, unknown>): string {
    const b64 = (obj: unknown) =>
      Buffer.from(JSON.stringify(obj)).toString("base64url");
    const header = b64({ alg: "HS256", typ: "JWT" });
    const body = b64(payload);
    const data = `${header}.${body}`;
    const sig = crypto
      .createHmac("sha256", this.apiSecret)
      .update(data)
      .digest("base64url");
    return `${data}.${sig}`;
  }

  /** Verifica la firma de un webhook de LiveKit (`Authorization: <jwt>` con sha256 del body). */
  verifyWebhook(authHeader: string | undefined, rawBody: string): boolean {
    if (!this.configured || !authHeader) return false;
    const parts = authHeader.split(".");
    if (parts.length !== 3) return false;
    const [h, p, s] = parts;
    const expected = crypto
      .createHmac("sha256", this.apiSecret)
      .update(`${h}.${p}`)
      .digest("base64url");
    if (!crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected))) return false;
    try {
      const claims = JSON.parse(Buffer.from(p, "base64url").toString("utf8")) as {
        iss?: string;
        exp?: number;
        sha256?: string;
      };
      if (claims.iss !== this.apiKey) return false;
      if (claims.exp && claims.exp < Math.floor(Date.now() / 1000)) return false;
      const bodyHash = crypto.createHash("sha256").update(rawBody).digest("base64");
      return claims.sha256 === bodyHash;
    } catch {
      return false;
    }
  }
}
