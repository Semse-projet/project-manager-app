import { NextRequest, NextResponse } from "next/server";
import { fetchSemseData, handleServerError, isSemseRuntimeEnabled, runtimeDisabledResponse } from "../../_server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isSemseRuntimeEnabled()) return runtimeDisabledResponse();

  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId");
    const status = url.searchParams.get("status");
    const qs = new URLSearchParams();
    if (projectId) qs.set("projectId", projectId);
    if (status) qs.set("status", status);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    const data = await fetchSemseData(`/v1/buildops/tasks${suffix}`);
    return NextResponse.json({ requestId: `buildops-tasks-${Date.now()}`, data });
  } catch (error) {
    return handleServerError(error);
  }
}

export async function POST(req: NextRequest) {
  if (!isSemseRuntimeEnabled()) return runtimeDisabledResponse();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { status: 400, message: "Invalid JSON body" } }, { status: 400 });
  }

  try {
    const data = await fetchSemseData("/v1/buildops/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return NextResponse.json({ requestId: `buildops-task-create-${Date.now()}`, data }, { status: 201 });
  } catch (error) {
    return handleServerError(error);
  }
}
