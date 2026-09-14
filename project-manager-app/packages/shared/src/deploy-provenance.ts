// ADR-030 — Independent service provenance.
//
// Railway injects RAILWAY_GIT_COMMIT_SHA (and related RAILWAY_GIT_* vars) at
// deploy time for GitHub-connected services. Reading it here means a deploy
// that bypassed Git entirely (e.g. `railway up`, as happened to semse-API/
// Web/Worker as of 2026-08-31 — see
// docs/reportes/2026-09-11_f01_procedencia_release_api_web_worker.md) is
// immediately visible as "unknown" instead of requiring a manual
// `railway deployment list` audit to discover.
//
// Lives in @semse/shared (not apps/api) so API, Web and Worker each read
// their own provenance the same way — one owner, no per-service duplicate.
//
// Never fabricate a value here. "unknown" is the only acceptable fallback.

export type DeployProvenance = {
  gitSha: string;
  buildTime: string;
};

function nonEmpty(value: string | undefined): string | undefined {
  return value && value.trim().length > 0 ? value : undefined;
}

export function getDeployProvenance(
  env: Record<string, string | undefined> = process.env
): DeployProvenance {
  return {
    gitSha: nonEmpty(env.RAILWAY_GIT_COMMIT_SHA) ?? "unknown",
    buildTime: nonEmpty(env.RAILWAY_DEPLOYMENT_CREATED_AT) ?? "unknown",
  };
}
