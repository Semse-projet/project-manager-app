import { NextRequest, NextResponse } from "next/server";
import {
  fetchSemseDataForRequest,
  handleServerError,
  isSemseRuntimeEnabled,
  runtimeDisabledResponse
} from "../../_server";

export const dynamic = "force-dynamic";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ContextMemoryEntryDto {
  id: string;
  tenantId: string;
  subject: string;
  predicate: string;
  object: string;
  confidence: number;
  visibility: "TEAM" | "ORG" | "PUBLIC";
  worklogId: string | null;
  createdBy: string;
  createdAt: string;
}

// ── GET /api/semse/field-ops/facts ────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!isSemseRuntimeEnabled()) return runtimeDisabledResponse();

  const { searchParams } = new URL(req.url);
  const subject   = searchParams.get("subject")   ?? undefined;
  const predicate = searchParams.get("predicate") ?? undefined;

  const qs = new URLSearchParams();
  if (subject)   qs.set("subject", subject);
  if (predicate) qs.set("predicate", predicate);
  const query = qs.toString() ? `?${qs.toString()}` : "";

  try {
    const data = await fetchSemseDataForRequest<ContextMemoryEntryDto[]>(`/v1/field-ops/facts${query}`, req);
    return NextResponse.json({ requestId: `fo-facts-${Date.now()}`, data });
  } catch (error) {
    return handleServerError(error);
  }
}

// ── POST /api/semse/field-ops/facts ───────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!isSemseRuntimeEnabled()) return runtimeDisabledResponse();

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: { status: 400, message: "Invalid JSON body" } }, { status: 400 }); }

  try {
    const data = await fetchSemseDataForRequest<ContextMemoryEntryDto>("/v1/field-ops/facts", req, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return NextResponse.json({ requestId: `fo-fact-create-${Date.now()}`, data }, { status: 201 });
  } catch (error) {
    return handleServerError(error);
  }
}
