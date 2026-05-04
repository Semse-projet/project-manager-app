import { NextRequest, NextResponse } from "next/server";
import { fetchSemseData, handleServerError, isSemseRuntimeEnabled, runtimeDisabledResponse } from "../../../../_server";

export const dynamic = "force-dynamic";

interface ComplianceDocDto {
  id: string; tenantId: string; vendorId: string; type: string;
  status: "MISSING" | "PENDING" | "APPROVED" | "EXPIRED";
  fileUrl: string | null; expiresAt: string | null; notes: string | null;
  updatedAt: string; createdAt: string;
}

// ── PUT /api/semse/field-ops/vendors/[vendorId]/compliance ────────────────────

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ vendorId: string }> },
) {
  if (!isSemseRuntimeEnabled()) return runtimeDisabledResponse();

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: { status: 400, message: "Invalid JSON body" } }, { status: 400 }); }

  try {
    const { vendorId } = await params;
    const data = await fetchSemseData<ComplianceDocDto>(`/v1/field-ops/vendors/${vendorId}/compliance`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return NextResponse.json({ requestId: `fo-compliance-${Date.now()}`, data });
  } catch (error) {
    return handleServerError(error);
  }
}
