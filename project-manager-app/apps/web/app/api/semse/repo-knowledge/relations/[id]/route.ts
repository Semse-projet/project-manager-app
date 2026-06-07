import { NextRequest, NextResponse } from "next/server";
import type { RepoRelation } from "@semse/schemas";
import { fetchSemseDataForRequest, handleServerError, runtimeDisabledResponse } from "../../../_server";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const data = await fetchSemseDataForRequest<RepoRelation[]>(`/v1/repo-knowledge/relations/${id}`, request);
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) {
      return runtimeDisabledResponse();
    }

    return handleServerError(error);
  }
}
