import { BadRequestException } from "@nestjs/common";
import {
  normalizeAllowedHost,
  parseHostnameAllowlist,
  resolveAllowlistedSafeUrl,
} from "@semse/shared";

/**
 * Hosts allowed for AgroEvidenceItem.fileUrl.
 *
 * SEMSE_EVIDENCE_FILE_URL_ALLOWED_HOSTS is the explicit list (comma-separated).
 * Hosts from SEMSE_WEB_BASE_URL and SEMSE_API_BASE_URL are added so official
 * storage public URLs can be persisted. An empty list is fail-closed.
 * Being on the list does not bypass HTTPS / public-IP checks.
 */
export function evidenceFileUrlAllowedHosts(env: NodeJS.ProcessEnv = process.env): string[] {
  const hosts = new Set<string>(parseHostnameAllowlist(env.SEMSE_EVIDENCE_FILE_URL_ALLOWED_HOSTS));
  for (const key of ["SEMSE_WEB_BASE_URL", "SEMSE_API_BASE_URL"] as const) {
    const raw = env[key];
    if (!raw) continue;
    try {
      const host = normalizeAllowedHost(new URL(raw).hostname);
      if (host) hosts.add(host);
    } catch {
      // ignore unparsable base URLs
    }
  }
  return [...hosts];
}

export async function assertSafeEvidenceFileUrl(
  fileUrl: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const allowedHosts = evidenceFileUrlAllowedHosts(env);
  const result = await resolveAllowlistedSafeUrl(fileUrl, { allowedHosts });
  if (!result.safe) {
    throw new BadRequestException(`FILE_URL_NOT_SAFE: ${result.reason}`);
  }
}
