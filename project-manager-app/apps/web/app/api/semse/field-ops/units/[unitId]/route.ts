import { NextRequest, NextResponse } from "next/server";
import { fetchSemseData, handleServerError, isSemseRuntimeEnabled, runtimeDisabledResponse } from "../../../_server";

export const dynamic = "force-dynamic";

interface UnitWithWorklogs {
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
  worklogs: Array<{
    id: string;
    date: string;
    doneToday: string;
    pendingNext: string;
    blockers: string | null;
    notes: string | null;
    createdBy: string;
    createdAt: string;
  }>;
}

// ── GET /api/semse/field-ops/units/[unitId] ───────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ unitId: string }> },
) {
  if (!isSemseRuntimeEnabled()) return runtimeDisabledResponse();

  try {
    const { unitId } = await params;
    const data = await fetchSemseData<UnitWithWorklogs>(`/v1/field-ops/units/${unitId}`);
    return NextResponse.json({ requestId: `fo-unit-${Date.now()}`, data });
  } catch (error) {
    return handleServerError(error);
  }
}
