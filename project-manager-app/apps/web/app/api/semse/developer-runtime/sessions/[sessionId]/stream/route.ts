import { type NextRequest } from "next/server";
import { fetchSemseDataForRequest, runtimeDisabledResponse } from "../../../../_server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function encodeEvent(data: unknown, event = "session-detail") {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await context.params;
    const stream = new ReadableStream({
      async start(controller) {
        let closed = false;

        const close = () => {
          if (closed) return;
          closed = true;
          controller.close();
        };

        request.signal.addEventListener("abort", close);

        const pushDetail = async () => {
          const data = await fetchSemseDataForRequest(
            `/v1/developer-runtime/sessions/${encodeURIComponent(sessionId)}`,
            request,
          );
          controller.enqueue(new TextEncoder().encode(encodeEvent(data)));
        };

        try {
          await pushDetail();
        } catch (error) {
          controller.enqueue(new TextEncoder().encode(encodeEvent({
            message: error instanceof Error ? error.message : "stream fetch failed",
          }, "stream-error")));
          close();
          return;
        }

        const interval = setInterval(async () => {
          if (closed) return;
          try {
            await pushDetail();
            controller.enqueue(new TextEncoder().encode(`event: heartbeat\ndata: ${Date.now()}\n\n`));
          } catch (error) {
            controller.enqueue(new TextEncoder().encode(encodeEvent({
              message: error instanceof Error ? error.message : "stream fetch failed",
            }, "stream-error")));
            clearInterval(interval);
            close();
          }
        }, 2000);

        request.signal.addEventListener("abort", () => {
          clearInterval(interval);
          close();
        });
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) {
      return runtimeDisabledResponse();
    }

    return new Response(JSON.stringify({
      error: {
        status: 502,
        message: error instanceof Error ? error.message : "Unknown stream error",
      },
    }), {
      status: 502,
      headers: {
        "content-type": "application/json",
      },
    });
  }
}
