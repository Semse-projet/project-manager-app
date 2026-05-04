import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, isApiBaseConfigured, runtimeDisabledResponse } from "../../../_server";
import type { AutonomyRunView } from "@semse/schemas";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, context: { params: Promise<{ runId: string }> }) {
  if (!isApiBaseConfigured()) {
    return runtimeDisabledResponse();
  }

  try {
    const { runId } = await context.params;
    const data = await fetchSemseDataForRequest<AutonomyRunView>(`/v1/autonomy/runs/${encodeURIComponent(runId)}`, req);

    if (!data.generatedContent) {
      return NextResponse.json(
        { error: { status: 404, message: `Generated file for run ${runId} is not available` } },
        { status: 404 }
      );
    }

    const filename = data.generatedFile?.split("/").pop() ?? `${runId}.txt`;
    return new NextResponse(data.generatedContent, {
      status: 200,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "content-disposition": `inline; filename="${filename.replace(/"/g, "")}"`
      }
    });
  } catch (error) {
    return handleServerError(error);
  }
}
