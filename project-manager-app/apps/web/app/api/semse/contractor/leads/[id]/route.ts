import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError } from "../../../_server";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const data = await fetchSemseDataForRequest(`/v1/contractor/leads/${id}`, request);
    return NextResponse.json({ data });
  } catch (e) { return handleServerError(e); }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const data = await fetchSemseDataForRequest(`/v1/contractor/leads/${id}`, request, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return NextResponse.json({ data });
  } catch (e) { return handleServerError(e); }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const data = await fetchSemseDataForRequest(`/v1/contractor/leads/${id}`, request, { method: "DELETE" });
    return NextResponse.json({ data });
  } catch (e) { return handleServerError(e); }
}
