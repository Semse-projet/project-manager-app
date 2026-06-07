/**
 * Auth session utilities — safe to import in both Edge (middleware) and Node.js.
 * Cookie format: <payload-base64url>.<hmac-base64url>
 */

import { appRoleFromPathname, appRoleFromRoles, defaultDashboardForRole as resolveDashboardForRole, type AppRole } from "@semse/auth/rbac";
import type { RequestIdentity } from "@semse/shared";

export const SESSION_COOKIE = "semse_session";

export type SessionPayload = RequestIdentity & {
  exp: number; // Unix timestamp seconds
};

const DEV_SESSION_SECRET = "semse-dev-session-secret";
const HMAC_ALGORITHM = { name: "HMAC", hash: "SHA-256" } as const;
const textEncoder = new TextEncoder();

function resolveSessionSecret(): string | null {
  const explicit = process.env.SEMSE_WEB_SESSION_SECRET?.trim() || process.env.AUTH_SECRET?.trim();
  if (explicit) {
    return explicit;
  }

  if (process.env.NODE_ENV !== "production") {
    return DEV_SESSION_SECRET;
  }

  return null;
}

function requireSessionSecret(): string {
  const secret = resolveSessionSecret();
  if (!secret) {
    throw new Error("SEMSE_WEB_SESSION_SECRET or AUTH_SECRET is required for signed sessions");
  }
  return secret;
}

function b64urlEncode(str: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(str).toString("base64url");
  }

  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlDecode(str: string): string {
  const rem = str.length % 4;
  const padded = rem === 0 ? str : str + "=".repeat(4 - rem);
  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");

  if (typeof Buffer !== "undefined") {
    return Buffer.from(base64, "base64").toString("utf8");
  }

  return decodeURIComponent(escape(atob(base64)));
}

function bytesToB64url(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64url");
  }

  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlToBytes(value: string): Uint8Array {
  const rem = value.length % 4;
  const padded = rem === 0 ? value : value + "=".repeat(4 - rem);
  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");

  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(base64, "base64"));
  }

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function importSessionKey(secret: string): Promise<CryptoKey> {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto API is not available");
  }

  return globalThis.crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    HMAC_ALGORITHM,
    false,
    ["sign", "verify"]
  );
}

async function signValue(value: string, secret: string): Promise<string> {
  const key = await importSessionKey(secret);
  const signature = await globalThis.crypto.subtle.sign(HMAC_ALGORITHM.name, key, textEncoder.encode(value));
  return bytesToB64url(new Uint8Array(signature));
}

async function verifyValue(value: string, signature: string, secret: string): Promise<boolean> {
  const key = await importSessionKey(secret);
  const signatureBytes = b64urlToBytes(signature);
  return globalThis.crypto.subtle.verify(
    HMAC_ALGORITHM.name,
    key,
    new Uint8Array(signatureBytes).buffer,
    textEncoder.encode(value)
  );
}

export async function encodeSession(payload: SessionPayload): Promise<string> {
  const encodedPayload = b64urlEncode(JSON.stringify(payload));
  const signature = await signValue(encodedPayload, requireSessionSecret());
  return `${encodedPayload}.${signature}`;
}

export async function decodeSession(cookie: string): Promise<SessionPayload | null> {
  try {
    const separator = cookie.lastIndexOf(".");
    if (separator <= 0 || separator === cookie.length - 1) {
      return null;
    }

    const encodedPayload = cookie.slice(0, separator);
    const signature = cookie.slice(separator + 1);
    const secret = resolveSessionSecret();
    if (!secret) {
      return null;
    }

    const validSignature = await verifyValue(encodedPayload, signature, secret);
    if (!validSignature) {
      return null;
    }

    const json = b64urlDecode(encodedPayload);
    const parsed = JSON.parse(json) as SessionPayload;
    const now = Math.floor(Date.now() / 1000);
    if (parsed.exp < now) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function roleFromPathname(pathname: string): AppRole {
  return appRoleFromPathname(pathname);
}

export function defaultDashboardForRole(role: AppRole): string {
  return resolveDashboardForRole(role);
}

export function roleFromRoles(roles: string[]): AppRole {
  return appRoleFromRoles(roles);
}

export async function buildSessionCookie(
  payload: SessionPayload,
  options: { secure?: boolean } = {}
): Promise<string> {
  const value = await encodeSession(payload);
  const maxAge = payload.exp - Math.floor(Date.now() / 1000);
  const secure = options.secure ? "; Secure" : "";
  return `${SESSION_COOKIE}=${value}; Path=/; Max-Age=${maxAge}; SameSite=Lax; HttpOnly${secure}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax; HttpOnly`;
}
