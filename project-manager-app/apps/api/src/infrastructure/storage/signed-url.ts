import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * C19/C10 — URLs firmadas y con expiracion para lecturas de archivos subidos.
 * Spec: docs/specs/platform/signed-file-access.spec.md
 *
 *   sig = HMAC-SHA256(secret, "GET\n{key}\n{exp}")  (hex, comparacion en tiempo constante)
 *
 * La firma cubre solo la clave y la expiracion con el verbo GET: no sirve para
 * otra clave ni para escritura.
 */

export type UploadsSignedGetMode = "off" | "shadow" | "enforce";

export const DEFAULT_BROWSER_TTL_SECONDS = 900; // 15 min
export const DEFAULT_VISION_TTL_SECONDS = 300; // 5 min
export const MAX_TTL_SECONDS = 3600;

export function resolveSignedGetMode(env: NodeJS.ProcessEnv = process.env): UploadsSignedGetMode {
  const raw = (env.UPLOADS_SIGNED_GET_MODE ?? "off").trim().toLowerCase();
  return raw === "shadow" || raw === "enforce" ? raw : "off";
}

/** Secretos activos: el actual primero, el anterior (rotacion) despues. */
export function resolveSigningSecrets(env: NodeJS.ProcessEnv = process.env): string[] {
  return [env.UPLOADS_SIGNING_SECRET, env.UPLOADS_SIGNING_SECRET_PREVIOUS]
    .map((s) => (s ?? "").trim())
    .filter((s) => s.length >= 16);
}

export function resolveTtlSeconds(kind: "browser" | "vision", env: NodeJS.ProcessEnv = process.env): number {
  const raw = Number(kind === "vision" ? env.UPLOADS_SIGNED_URL_TTL_VISION_SECONDS : env.UPLOADS_SIGNED_URL_TTL_SECONDS);
  const fallback = kind === "vision" ? DEFAULT_VISION_TTL_SECONDS : DEFAULT_BROWSER_TTL_SECONDS;
  if (!Number.isFinite(raw) || raw <= 0) return fallback;
  return Math.min(Math.floor(raw), MAX_TTL_SECONDS);
}

function mac(secret: string, key: string, exp: number): Buffer {
  return createHmac("sha256", secret).update(`GET\n${key}\n${exp}`).digest();
}

export function signKey(key: string, exp: number, secret: string): string {
  return mac(secret, key, exp).toString("hex");
}

export type SignatureCheck = "valid" | "expired" | "invalid" | "absent";

export function checkSignature(
  input: { key: string; exp?: string | null; sig?: string | null; nowSeconds?: number },
  secrets: string[],
): SignatureCheck {
  if (!input.exp && !input.sig) return "absent";
  const exp = Number(input.exp);
  if (!input.sig || !Number.isInteger(exp) || secrets.length === 0) return "invalid";
  const provided = Buffer.from(input.sig, "hex");
  let matched = false;
  for (const secret of secrets) {
    const expected = mac(secret, input.key, exp);
    if (provided.length === expected.length && timingSafeEqual(provided, expected)) matched = true;
  }
  if (!matched) return "invalid";
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  return exp < now ? "expired" : "valid";
}

/** `tenants/{tenantId}/...` -> tenantId; null para claves legacy/publicas. */
export function tenantFromStorageKey(key: string): string | null {
  const m = /^tenants\/([A-Za-z0-9_-]+)\//.exec(key);
  return m ? m[1] : null;
}

export function resolvePublicPrefixes(env: NodeJS.ProcessEnv = process.env): string[] {
  return (env.UPLOADS_PUBLIC_KEY_PREFIXES ?? "public/")
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && p.endsWith("/"));
}

export type ReadDecision = {
  allow: boolean;
  status?: 401 | 403;
  reason:
    | "public_prefix"
    | "mode_off"
    | "signed_valid"
    | "signature_expired"
    | "signature_invalid"
    | "session_tenant_match"
    | "session_ops_admin"
    | "session_tenant_mismatch"
    | "unsigned_shadow"
    | "unsigned_denied";
  signed: boolean;
  authenticated: boolean;
  logUnsigned: boolean;
};

export function decideRead(input: {
  mode: UploadsSignedGetMode;
  key: string;
  signature: SignatureCheck;
  session: { tenantId: string; roles: string[] } | null;
  publicPrefixes: string[];
}): ReadDecision {
  const { mode, key, signature, session } = input;
  const base = { signed: signature === "valid", authenticated: session !== null, logUnsigned: false };

  if (mode === "off") return { ...base, allow: true, reason: "mode_off" };
  if (input.publicPrefixes.some((p) => key.startsWith(p))) return { ...base, allow: true, reason: "public_prefix" };

  if (signature === "valid") return { ...base, allow: true, reason: "signed_valid" };
  // Una firma presente pero mala/expirada se rechaza siempre: nunca cae a "sin firma".
  if (signature === "expired") return { ...base, allow: false, status: 403, reason: "signature_expired" };
  if (signature === "invalid") return { ...base, allow: false, status: 403, reason: "signature_invalid" };

  if (session) {
    if (session.roles.includes("OPS_ADMIN")) return { ...base, allow: true, reason: "session_ops_admin" };
    if (tenantFromStorageKey(key) === session.tenantId) return { ...base, allow: true, reason: "session_tenant_match" };
    return { ...base, allow: false, status: 403, reason: "session_tenant_mismatch" };
  }

  if (mode === "shadow") return { ...base, allow: true, reason: "unsigned_shadow", logUnsigned: true };
  return { ...base, allow: false, status: 403, reason: "unsigned_denied" };
}
