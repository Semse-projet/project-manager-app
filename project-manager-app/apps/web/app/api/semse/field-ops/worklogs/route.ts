import { NextRequest, NextResponse } from "next/server";
import { fetchSemseData, handleServerError, isSemseRuntimeEnabled, runtimeDisabledResponse } from "../../_server";

export const dynamic = "force-dynamic";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WorklogEntryDto {
  id: string;
  tenantId: string;
  fieldUnitId: string;
  date: string;
  doneToday: string;
  pendingNext: string;
  blockers: string | null;
  notes: string | null;
  createdBy: string;
  createdAt: string;
  fieldUnit?: { id: string; code: string; name: string | null };
}

// ── GET /api/semse/field-ops/worklogs ─────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!isSemseRuntimeEnabled()) return runtimeDisabledResponse();

  const { searchParams } = new URL(req.url);
  const fieldUnitId = searchParams.get("fieldUnitId") ?? undefined;
  const dateFrom    = searchParams.get("dateFrom") ?? undefined;
  const dateTo      = searchParams.get("dateTo") ?? undefined;

  const qs = new URLSearchParams();
  if (fieldUnitId) qs.set("fieldUnitId", fieldUnitId);
  if (dateFrom)    qs.set("dateFrom", dateFrom);
  if (dateTo)      qs.set("dateTo", dateTo);
  const query = qs.toString() ? `?${qs.toString()}` : "";

  try {
    const data = await fetchSemseData<WorklogEntryDto[]>(`/v1/field-ops/worklogs${query}`);
    return NextResponse.json({ requestId: `fo-worklogs-${Date.now()}`, data });
  } catch (error) {
    return handleServerError(error);
  }
}

// ── POST /api/semse/field-ops/worklogs ────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!isSemseRuntimeEnabled()) return runtimeDisabledResponse();

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: { status: 400, message: "Invalid JSON body" } }, { status: 400 }); }

  try {
    const data = await fetchSemseData<WorklogEntryDto>("/v1/field-ops/worklogs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return NextResponse.json({ requestId: `fo-worklog-create-${Date.now()}`, data }, { status: 201 });
  } catch (error) {
    return handleServerError(error);
  }
}
