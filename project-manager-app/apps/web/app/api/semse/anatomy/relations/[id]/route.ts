import { NextRequest, NextResponse } from "next/server";
import type { AnatomyRelation } from "@semse/schemas";
import { fetchSemseData, handleServerError, runtimeDisabledResponse } from "../../../_server";

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    const data = await fetchSemseData<AnatomyRelation[]>(`/v1/anatomy/relations/${id}`);
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) {
      return runtimeDisabledResponse();
    }

    return handleServerError(error);
  }
}

