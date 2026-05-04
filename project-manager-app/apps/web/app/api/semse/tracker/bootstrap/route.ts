import { type NextRequest, NextResponse } from "next/server";
import type { JobRecordView, TrackerSessionView, TrackerSnapshotView } from "@semse/schemas";
import { SEMSE_BOOTSTRAP_HEADER_NAME, trimToUndefined } from "@semse/shared";
import { decodeSession, SESSION_COOKIE } from "../../../../../lib/auth";

type ApiEnvelope<T> = {
  requestId: string;
  data: T;
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: {
      ...(init?.headers ?? {}),
    },
  });

  const payload = (await response.json().catch(() => ({}))) as ApiEnvelope<T> & {
    error?: { message?: string; status?: number };
  };

  if (!response.ok) {
    throw new Error(payload.error?.message ?? `${url} returned ${response.status}`);
  }

  return payload.data;
}

export async function POST(req: NextRequest) {
  const apiBaseUrl = trimToUndefined(process.env.SEMSE_API_BASE_URL)?.replace(/\/+$/, "");
  if (!apiBaseUrl) {
    return NextResponse.json({ error: { status: 503, message: "SEMSE server runtime is not configured" } }, { status: 503 });
  }

  const encoded = req.cookies.get(SESSION_COOKIE)?.value;
  const session = encoded ? await decodeSession(encoded) : null;
  if (!session) {
    return NextResponse.json({ error: { status: 401, message: "Missing or invalid SEMSE session" } }, { status: 401 });
  }

  const bootstrapToken = trimToUndefined(process.env.SEMSE_BOOTSTRAP_TOKEN);
  if (!bootstrapToken && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: { status: 503, message: "SEMSE bootstrap token is not configured" } }, { status: 503 });
  }

  try {
    const auth = await fetchJson<{ accessToken: string }>(`${apiBaseUrl}/v1/auth/token`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(bootstrapToken ? { [SEMSE_BOOTSTRAP_HEADER_NAME]: bootstrapToken } : {}),
      },
      body: JSON.stringify({
        tenantId: session.tenantId,
        orgId: session.orgId,
        userId: session.userId,
        roles: session.roles,
      }),
    });

    const headers = {
      "content-type": "application/json",
      authorization: `Bearer ${auth.accessToken}`,
    };

    const snapshot = await fetchJson<TrackerSnapshotView>(`${apiBaseUrl}/v1/field-ops/tracker`, {
      headers: {
        authorization: `Bearer ${auth.accessToken}`,
      },
    });

    if (snapshot.activeSession?.id) {
      await fetchJson<TrackerSessionView>(`${apiBaseUrl}/v1/field-ops/tracker/${snapshot.activeSession.id}/stop`, {
        method: "POST",
        headers,
        body: JSON.stringify({ notes: "cleanup before tracker bootstrap" }),
      });
    }

    const now = Date.now();
    const job = await fetchJson<JobRecordView>(`${apiBaseUrl}/v1/jobs`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        title: `Tracker E2E ${now}`,
        scope: "Validacion Playwright del tracker persistente con reload.",
        budgetMin: 100,
        budgetMax: 250,
      }),
    });

    const sessionView = await fetchJson<TrackerSessionView>(`${apiBaseUrl}/v1/field-ops/tracker/start`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jobId: job.id,
        notes: "session seeded by web bootstrap",
      }),
    });

    return NextResponse.json({
      requestId: "web-tracker-bootstrap",
      data: {
        job,
        session: sessionView,
      },
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown tracker bootstrap error";
    return NextResponse.json({ error: { status: 502, message } }, { status: 502 });
  }
}
