import { NextRequest, NextResponse } from "next/server";
import {
  fetchSemseDataForRequest,
  handleServerError,
  isApiBaseConfigured,
  runtimeDisabledResponse,
} from "../../../_server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isApiBaseConfigured()) return runtimeDisabledResponse();
  try {
    const data = await fetchSemseDataForRequest<unknown[]>("/v1/admin/integrations/status", request);
    return NextResponse.json({ requestId: "web-admin-integrations-status", data });
  } catch (error) {
    return handleServerError(error);
  }
}
