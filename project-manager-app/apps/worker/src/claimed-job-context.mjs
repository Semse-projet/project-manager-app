/**
 * Worker-core fetch of the fenced job.created projection (#1161).
 * The claim token is sent only on this request and is never returned.
 */

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asString(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : "";
}

function asNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function shouldLoadClaimedJobContext(run) {
  if (run?.agentType !== "pricing" && run?.agentType !== "risk") return false;
  const input = asObject(run?.input);
  if (input.eventType !== "job.created") return false;
  return Boolean(asString(asObject(input.eventPayload).jobId));
}

export async function loadClaimedJobContext({ requestJson, run, claimToken, workerId, expectedAttempts, tenantId }) {
  if (!shouldLoadClaimedJobContext(run)) return null;
  const authorizedJobId = asString(asObject(asObject(run.input).eventPayload).jobId);
  const response = await requestJson(
    `/v1/agents/runs/${encodeURIComponent(run.id)}/claimed-job-context`,
    {
      method: "POST",
      body: JSON.stringify({ workerId, expectedAttempts, claimToken }),
    },
    { tenantId: tenantId ?? run.tenantId },
  );
  const data = asObject(response?.data);
  const job = asObject(data.job);
  if (asString(job.id) !== authorizedJobId) {
    throw new Error("claimed job context did not match the authorized event");
  }
  return {
    job: {
      id: authorizedJobId,
      title: asString(job.title),
      scope: asString(job.scope),
      category: asString(job.category),
      status: asString(job.status),
      urgency: asString(job.urgency),
      budgetMin: asNumber(job.budgetMin),
      budgetMax: asNumber(job.budgetMax),
    },
    projectId: asString(data.projectId),
    projectPresence: data.projectPresence === "present" ? "present" : "absent",
  };
}
