import { NextRequest, NextResponse } from "next/server";
import type { AnatomyNode } from "@semse/schemas";
import { fetchSemseDataForAuthenticatedRequest, handleServerError, runtimeDisabledResponse } from "../../../_server";

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    const data = await fetchSemseDataForAuthenticatedRequest<AnatomyNode[]>(`/v1/anatomy/children/${id}`, request);
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) {
      return runtimeDisabledResponse();
    }

    return handleServerError(error);
  }
}
