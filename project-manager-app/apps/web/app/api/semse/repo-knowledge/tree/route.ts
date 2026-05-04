import { NextResponse } from "next/server";
import type { RepoTreeNode } from "@semse/schemas";
import { fetchSemseData, handleServerError, runtimeDisabledResponse } from "../../_server";

export async function GET() {
  try {
    const data = await fetchSemseData<RepoTreeNode>("/v1/repo-knowledge/tree");
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) {
      return runtimeDisabledResponse();
    }

    return handleServerError(error);
  }
}
