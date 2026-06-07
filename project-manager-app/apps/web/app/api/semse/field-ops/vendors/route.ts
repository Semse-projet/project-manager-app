import { NextRequest, NextResponse } from "next/server";
import { fetchSemseData, handleServerError, isSemseRuntimeEnabled, runtimeDisabledResponse } from "../../_server";

export const dynamic = "force-dynamic";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ComplianceDocDto {
  id: string;
  tenantId: string;
  vendorId: string;
  type: string;
  status: "MISSING" | "PENDING" | "APPROVED" | "EXPIRED";
  fileUrl: string | null;
  expiresAt: string | null;
  notes: string | null;
  updatedAt: string;
  createdAt: string;
}

export interface VendorDto {
  id: string;
  tenantId: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  createdAt: string;
  compliance: ComplianceDocDto[];
}

// ── GET /api/semse/field-ops/vendors ──────────────────────────────────────────

export async function GET(_req: NextRequest) {
  void _req;
  if (!isSemseRuntimeEnabled()) return runtimeDisabledResponse();

  try {
    const data = await fetchSemseData<VendorDto[]>("/v1/field-ops/vendors");
    return NextResponse.json({ requestId: `fo-vendors-${Date.now()}`, data });
  } catch (error) {
    return handleServerError(error);
  }
}

// ── POST /api/semse/field-ops/vendors ─────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!isSemseRuntimeEnabled()) return runtimeDisabledResponse();

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: { status: 400, message: "Invalid JSON body" } }, { status: 400 }); }

  try {
    const data = await fetchSemseData<VendorDto>("/v1/field-ops/vendors", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return NextResponse.json({ requestId: `fo-vendor-create-${Date.now()}`, data }, { status: 201 });
  } catch (error) {
    return handleServerError(error);
  }
}
