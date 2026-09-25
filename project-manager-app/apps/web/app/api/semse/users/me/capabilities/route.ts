import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, resolveRuntimeConfigForRequest, runtimeDisabledResponse } from "../../../_server";
import { isCapabilitySelectorEnabled } from "../../../../../../lib/capability-flag";

export async function GET(request: NextRequest) {
  try {
    const runtimeConfig = await resolveRuntimeConfigForRequest(request);
    if (!runtimeConfig) {
      return runtimeDisabledResponse();
    }

    if (!isCapabilitySelectorEnabled(runtimeConfig.tenantId)) {
      return NextResponse.json({ data: { capabilities: [] } });
    }

    const data = await fetchSemseDataForRequest<{
      capabilities: Array<{ role: string; orgId: string; verifiedAt: string | null }>;
    }>("/v1/users/me/capabilities", request);
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) {
      return runtimeDisabledResponse();
    }

    return handleServerError(error);
  }
}
