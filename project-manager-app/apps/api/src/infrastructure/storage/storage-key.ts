import path from "node:path";

const STORAGE_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;
const STORAGE_DOMAINS = new Set(["evidence", "contract", "dispute", "travel"]);

export function normalizeStorageKey(key: string): string {
  const value = key.trim();
  if (!value || value.length > 512) {
    throw new Error("Invalid storage key");
  }
  if (value.startsWith("/") || value.includes("\\") || /[\u0000-\u001F\u007F]/.test(value)) {
    throw new Error("Invalid storage key");
  }
  if (!STORAGE_KEY_PATTERN.test(value)) {
    throw new Error("Invalid storage key");
  }

  const normalized = path.posix.normalize(value);
  if (normalized !== value || normalized === "." || normalized.startsWith("../") || normalized.includes("/../")) {
    throw new Error("Invalid storage key");
  }

  return value;
}

export function normalizeStorageDomain(domain: string): "evidence" | "contract" | "dispute" | "travel" {
  const value = domain.trim().toLowerCase();
  if (!STORAGE_DOMAINS.has(value)) {
    throw new Error("Invalid storage domain");
  }
  return value as "evidence" | "contract" | "dispute" | "travel";
}

export function buildTenantStorageKey(input: {
  tenantId: string;
  domain: "evidence" | "contract" | "dispute" | "travel";
  filename: string;
  nonce: string;
  scope?: "public-intake";
}): string {
  const tenantId = input.tenantId.trim();
  if (!/^[A-Za-z0-9_-]+$/.test(tenantId)) {
    throw new Error("Invalid tenant id for storage key");
  }

  const ext = path.extname(input.filename).toLowerCase().replace(/[^.a-z0-9]/g, "").slice(0, 16);
  const scope = input.scope ? `${input.scope}/` : "";
  return normalizeStorageKey(`tenants/${tenantId}/${scope}${input.domain}/${input.nonce}${ext}`);
}

export function isTenantScopedStorageKey(input: {
  key: string;
  tenantId: string;
  domain?: "evidence" | "contract" | "dispute" | "travel";
}): boolean {
  const key = normalizeStorageKey(input.key);
  const domainSuffix = input.domain ? `/${input.domain}/` : "/";
  return key.startsWith(`tenants/${input.tenantId}/`) && key.includes(domainSuffix);
}

export function isLegacyDomainStorageKey(key: string, domain: "evidence" | "contract" | "dispute" | "travel"): boolean {
  return normalizeStorageKey(key).startsWith(`${domain}/`);
}
