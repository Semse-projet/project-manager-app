import { type NextRequest, NextResponse } from "next/server";
import { ensureIntakeSession, fetchPublicIntake, resolvePublicApiBase, resolveTenantId, withIntakeSession } from "../../_shared";

type UploadPlan = {
  uploadUrl: string;
  key: string;
};

type UploadResult = {
  key: string;
  url: string;
  sizeBytes: number;
};

export const runtime = "nodejs";

async function requestUploadPlan(file: File): Promise<UploadPlan> {
  const params = new URLSearchParams({
    filename: file.name,
    contentType: file.type || "application/octet-stream",
    domain: "evidence",
  });

  const response = await fetch(`${resolvePublicApiBase()}/v1/uploads/plan?${params.toString()}`, {
    method: "GET",
    cache: "no-store",
    headers: {
      "x-tenant-id": resolveTenantId(),
    },
  });
  if (!response.ok) {
    throw new Error("Could not create upload plan");
  }
  return response.json() as Promise<UploadPlan>;
}

async function uploadFile(file: File): Promise<UploadResult> {
  const plan = await requestUploadPlan(file);
  const buffer = Buffer.from(await file.arrayBuffer());
  const response = await fetch(plan.uploadUrl, {
    method: "PUT",
    headers: {
      "content-type": file.type || "application/octet-stream",
      "content-length": String(buffer.byteLength),
    },
    body: buffer,
  });

  if (!response.ok) {
    throw new Error("Could not upload intake image");
  }

  return response.json() as Promise<UploadResult>;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { sessionToken } = ensureIntakeSession(request);

  try {
    const { id } = await context.params;
    const form = await request.formData();
    const imageType = String(form.get("imageType") ?? "before");
    const files = form.getAll("files").filter((value): value is File => value instanceof File);

    if (files.length === 0) {
      return withIntakeSession(
        NextResponse.json({ error: { message: "At least one file is required" } }, { status: 400 }),
        sessionToken,
      );
    }

    const uploaded = await Promise.all(files.map(async (file) => {
      const result = await uploadFile(file);
      return {
        key: result.key,
        url: result.url,
        thumbnailUrl: result.url,
        originalName: file.name,
        contentType: file.type || "application/octet-stream",
        sizeBytes: result.sizeBytes || file.size,
      };
    }));

    const data = await fetchPublicIntake<Record<string, unknown>>(`/v1/intake/${encodeURIComponent(id)}/images`, sessionToken, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionToken,
        imageType,
        images: uploaded,
      }),
    });

    return withIntakeSession(NextResponse.json({ data }), sessionToken);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Service unavailable";
    return withIntakeSession(NextResponse.json({ error: { message } }, { status: 503 }), sessionToken);
  }
}
