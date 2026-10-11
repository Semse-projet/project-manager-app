import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, isApiBaseConfigured, runtimeDisabledResponse } from "../../../_server";

export const dynamic = "force-dynamic";

// El segmento dinamico se llama `correlationId` porque Next.js exige el mismo
// nombre de parametro que la ruta hermana `[correlationId]/route.ts`; en esta
// ruta contiene el `eventId` (UUID) cuyo detalle de entregas se consulta. La
// API valida que sea UUID y exige `domain-events:read`.
type RouteContext = {
  params: Promise<{
    correlationId: string;
  }>;
};

export async function GET(req: NextRequest, context: RouteContext) {
  if (!isApiBaseConfigured()) {
    return runtimeDisabledResponse();
  }

  try {
    const { correlationId: eventId } = await context.params;
    const data = await fetchSemseDataForRequest(
      `/v1/domain-events/${encodeURIComponent(eventId)}/deliveries`,
      req
    );

    return NextResponse.json({
      requestId: "web-domain-events-deliveries",
      data
    });
  } catch (error) {
    return handleServerError(error);
  }
}
