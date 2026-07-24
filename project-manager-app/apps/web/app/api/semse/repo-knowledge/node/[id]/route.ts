import { NextRequest, NextResponse } from "next/server";
import type { RepoNode } from "@semse/schemas";
import { fetchSemseDataForAuthenticatedRequest, handleServerError, runtimeDisabledResponse } from "../../../_server";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const data = await fetchSemseDataForAuthenticatedRequest<RepoNode>(`/v1/repo-knowledge/node/${id}`, request);
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) {
      return runtimeDisabledResponse();
    }

    return handleServerError(error);
  }
}
