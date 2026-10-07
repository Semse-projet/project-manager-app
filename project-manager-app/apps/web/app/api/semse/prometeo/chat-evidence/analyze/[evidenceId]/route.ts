import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError } from "../../../../_server";
import { decodeSession, SESSION_COOKIE } from "../../../../../../../lib/auth";

export const dynamic = "force-dynamic";

// Lanza el análisis visual de UNA evidencia desde el chat (spec prometeo/chat-evidence). Solo con clic del usuario: el API
// aplica flag, pertenencia, tope diario y auditoría; esta ruta solo reenvía con la sesión y sin aceptar nada más que el id.
const SAFE_ID = /^[A-Za-z0-9_.:-]{1,64}$/;

async function requireSession(request: NextRequest): Promise<NextResponse | null> {
  if (request.headers.get("x-semse-user-id")?.trim()) {
    return null;
  }

  const encoded = request.cookies.get(SESSION_COOKIE)?.value;
  const session = encoded ? await decodeSession(encoded) : null;
  if (session) {
    return null;
  }

  return NextResponse.json(
    { error: { status: 401, message: "Authentication required for chat evidence analysis." } },
    { status: 401 },
  );
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ evidenceId: string }> },
) {
  try {
    const authError = await requireSession(request);
    if (authError) return authError;

    const { evidenceId } = await context.params;
    if (!SAFE_ID.test(evidenceId)) {
      return NextResponse.json({ error: { status: 400, message: "Invalid evidence id." } }, { status: 400 });
    }
    const raw = (await request.json().catch(() => ({}))) as { chatRequestId?: unknown };
    const chatRequestId = typeof raw.chatRequestId === "string" && SAFE_ID.test(raw.chatRequestId) ? raw.chatRequestId : undefined;
    const data = await fetchSemseDataForRequest(
      `/v1/prometeo/chat-evidence/analyze/${encodeURIComponent(evidenceId)}`,
      request,
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(chatRequestId ? { chatRequestId } : {}) },
    );
    return NextResponse.json({ data });
  } catch (e) { return handleServerError(e); }
}
