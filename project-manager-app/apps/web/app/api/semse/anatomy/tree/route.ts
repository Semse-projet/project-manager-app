import { NextResponse } from "next/server";
import type { AnatomyTreeNode } from "@semse/schemas";
import { fetchSemseData, handleServerError, runtimeDisabledResponse } from "../../_server";

export async function GET() {
  try {
    const data = await fetchSemseData<AnatomyTreeNode>("/v1/anatomy/tree");
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) {
      return runtimeDisabledResponse();
    }

    return handleServerError(error);
  }
}

