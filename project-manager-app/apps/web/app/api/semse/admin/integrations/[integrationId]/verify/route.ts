import { NextRequest, NextResponse } from "next/server";
import {
  fetchSemseDataForRequest,
  handleServerError,
  isApiBaseConfigured,
  runtimeDisabledResponse,
} from "../../../../_server";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ integrationId: string }> },
) {
  if (!isApiBaseConfigured()) return runtimeDisabledResponse();
  try {
    const { integrationId } = await context.params;
    const data = await fetchSemseDataForRequest<Record<string, unknown>>(
      `/v1/admin/integrations/${encodeURIComponent(integrationId)}/verify`,
      request,
      { method: "POST" },
    );
    return NextResponse.json({ requestId: "web-admin-integration-verify", data });
  } catch (error) {
    return handleServerError(error);
  }
}
