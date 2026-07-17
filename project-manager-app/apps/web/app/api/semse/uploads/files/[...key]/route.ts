import { type NextRequest, NextResponse } from "next/server";
import {
  buildAuthorizedHeaders,
  handleServerError,
  resolveRuntimeConfigForRequest,
} from "../../../_server";

export const dynamic = "force-dynamic";

/**
 * PUT /api/semse/uploads/files/[...key]
 * Proxies a raw file body to the API storage endpoint.
 * Used by the frontend evidence upload flow.
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ key: string[] }> },
) {
  try {
    const { key } = await context.params;
    const keyStr = key.join("/");
    const config = await resolveRuntimeConfigForRequest(request);
    if (!config) {
      return NextResponse.json({ error: { status: 503, message: "SEMSE runtime not configured" } }, { status: 503 });
    }

    const contentType = request.headers.get("content-type") ?? "application/octet-stream";
    const body = await request.arrayBuffer();
    const authorizedHeaders = await buildAuthorizedHeaders(config);

    const apiRes = await fetch(`${config.apiBaseUrl}/v1/uploads/files/${encodeURIComponent(keyStr)}`, {
      method: "PUT",
      headers: {
        ...authorizedHeaders,
        "content-type": contentType,
        "content-length": String(body.byteLength),
      },
      body,
    });

    if (!apiRes.ok) {
      const text = await apiRes.text();
      return NextResponse.json(
        { error: { status: apiRes.status, message: text || "Upload failed" } },
        { status: apiRes.status },
      );
    }

    const data = await apiRes.json();
    return NextResponse.json({ data });
  } catch (error) {
    return handleServerError(error);
  }
}

/**
 * GET /api/semse/uploads/files/[...key]
 * Proxies file serving from the API storage.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ key: string[] }> },
) {
  try {
    const { key } = await context.params;
    const keyStr = key.join("/");
    const config = await resolveRuntimeConfigForRequest(request);
    if (!config) {
      return NextResponse.json({ error: { status: 503, message: "SEMSE runtime not configured" } }, { status: 503 });
    }

    const apiRes = await fetch(`${config.apiBaseUrl}/v1/uploads/files/${encodeURIComponent(keyStr)}`, {
      method: "GET",
    });

    if (!apiRes.ok) {
      return NextResponse.json({ error: { status: apiRes.status, message: "File not found" } }, { status: apiRes.status });
    }

    const contentType = apiRes.headers.get("content-type") ?? "application/octet-stream";
    const buffer = await apiRes.arrayBuffer();

    return new Response(buffer, {
      headers: {
        "content-type": contentType,
        "cache-control": "private, max-age=3600",
      },
    });
  } catch (error) {
    return handleServerError(error);
  }
}
