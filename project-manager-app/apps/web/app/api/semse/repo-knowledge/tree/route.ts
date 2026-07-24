import { NextRequest, NextResponse } from "next/server";
import type { RepoTreeNode } from "@semse/schemas";
import { fetchSemseDataForAuthenticatedRequest, handleServerError, runtimeDisabledResponse } from "../../_server";

export async function GET(request: NextRequest) {
  try {
    const data = await fetchSemseDataForAuthenticatedRequest<RepoTreeNode>("/v1/repo-knowledge/tree", request);
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) {
      return runtimeDisabledResponse();
    }

    return handleServerError(error);
  }
}
