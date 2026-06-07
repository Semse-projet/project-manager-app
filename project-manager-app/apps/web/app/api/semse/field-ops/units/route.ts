import { NextRequest, NextResponse } from "next/server";
import { fetchSemseData, handleServerError, isSemseRuntimeEnabled, runtimeDisabledResponse } from "../../_server";

export const dynamic = "force-dynamic";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FieldUnitDto {
  id: string;
  tenantId: string;
  projectId: string;
  code: string;
  name: string | null;
  address: string | null;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETE" | "ON_HOLD" | "CANCELLED";
  metadataJson: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

// ── GET /api/semse/field-ops/units ────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!isSemseRuntimeEnabled()) return runtimeDisabledResponse();

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId") ?? undefined;
  const status    = searchParams.get("status") ?? undefined;

  const qs = new URLSearchParams();
  if (projectId) qs.set("projectId", projectId);
  if (status)    qs.set("status", status);
  const query = qs.toString() ? `?${qs.toString()}` : "";

  try {
    const data = await fetchSemseData<FieldUnitDto[]>(`/v1/field-ops/units${query}`);
    return NextResponse.json({ requestId: `fo-units-${Date.now()}`, data });
  } catch (error) {
    return handleServerError(error);
  }
}

// ── POST /api/semse/field-ops/units ───────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!isSemseRuntimeEnabled()) return runtimeDisabledResponse();

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: { status: 400, message: "Invalid JSON body" } }, { status: 400 }); }

  try {
    const data = await fetchSemseData<FieldUnitDto>("/v1/field-ops/units", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return NextResponse.json({ requestId: `fo-unit-create-${Date.now()}`, data }, { status: 201 });
  } catch (error) {
    return handleServerError(error);
  }
}
