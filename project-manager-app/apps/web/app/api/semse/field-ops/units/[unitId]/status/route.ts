import { NextRequest, NextResponse } from "next/server";
import { fetchSemseData, handleServerError, isSemseRuntimeEnabled, runtimeDisabledResponse } from "../../../../_server";

export const dynamic = "force-dynamic";

interface FieldUnitDto {
  id: string; code: string; name: string | null; address: string | null;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETE" | "ON_HOLD" | "CANCELLED";
  projectId: string; tenantId: string; createdAt: string; updatedAt: string;
}

// ── PUT /api/semse/field-ops/units/[unitId]/status ────────────────────────────

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ unitId: string }> },
) {
  if (!isSemseRuntimeEnabled()) return runtimeDisabledResponse();

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: { status: 400, message: "Invalid JSON body" } }, { status: 400 }); }

  try {
    const { unitId } = await params;
    const data = await fetchSemseData<FieldUnitDto>(`/v1/field-ops/units/${unitId}/status`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return NextResponse.json({ requestId: `fo-unit-status-${Date.now()}`, data });
  } catch (error) {
    return handleServerError(error);
  }
}
