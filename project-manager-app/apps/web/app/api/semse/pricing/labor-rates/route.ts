import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError } from "../../_server";

export async function GET(request: NextRequest) {
  try {
    const data = await fetchSemseDataForRequest("/v1/pricing/labor-rates", request);
    return NextResponse.json({ data });
  } catch (error) {
    return handleServerError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const data = await fetchSemseDataForRequest("/v1/pricing/labor-rates", request, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return NextResponse.json({ data });
  } catch (error) {
    return handleServerError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const data = await fetchSemseDataForRequest("/v1/pricing/labor-rates", request, {
      method: "DELETE",
    });
    return NextResponse.json({ data });
  } catch (error) {
    return handleServerError(error);
  }
}
