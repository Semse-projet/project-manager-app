import { DashboardClient } from "./dashboard-client";
import { normalizeJobRecordStatus, type JobRecordView } from "@semse/schemas";
import { buildIdentityHeaders, parseRoleList, trimToUndefined } from "@semse/shared";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard · SEMSE" };

async function getJobs(): Promise<JobRecordView[]> {
  const baseUrl = trimToUndefined(process.env.SEMSE_API_BASE_URL);
  const tenantId = trimToUndefined(process.env.SEMSE_TENANT_ID);
  const orgId = trimToUndefined(process.env.SEMSE_ORG_ID);
  const userId = trimToUndefined(process.env.SEMSE_USER_ID);
  const roles    = process.env.SEMSE_ROLES?.trim() ?? "OPS_ADMIN";

  if (!baseUrl || !tenantId || !orgId || !userId) return [];

  try {
    const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/v1/jobs`, {
      headers: {
        ...buildIdentityHeaders({
          tenantId,
          orgId,
          userId,
          roles: parseRoleList(roles)
        })
      },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const payload = (await res.json()) as { data?: unknown };
    return Array.isArray(payload.data)
      ? (payload.data as JobRecordView[]).map(normalizeJobRecordStatus)
      : [];
  } catch {
    return [];
  }
}

export default async function DashboardPage() {
  const jobs = await getJobs();
  return <DashboardClient jobs={jobs} />;
}
