import { NextRequest, NextResponse } from "next/server";
import { handleServerError, runtimeDisabledResponse, buildSemseRequestHeaders, getServerConfig } from "../../_server";

const API = process.env.SEMSE_API_BASE_URL ?? "http://localhost:4000";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { milestoneTitle: string; trade: string };
    const cfg  = await getServerConfig(request);

    // Dispatch MILESTONE_CREATED to Evidence Agent via message bus and get checklist
    const resp = await fetch(`${API}/v1/agents/semse/evidence/checklist`, {
      method: "POST",
      headers: { "content-type": "application/json", ...buildSemseRequestHeaders(cfg) },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      // Fallback: generate checklist locally if endpoint not available
      const checklist = generateLocalChecklist(body.trade);
      return NextResponse.json({ data: checklist });
    }

    const json = await resp.json();
    return NextResponse.json(json);
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) return runtimeDisabledResponse();
    return handleServerError(error);
  }
}

function generateLocalChecklist(trade: string) {
  const templates: Record<string, Array<{ label: string; kind: string; description: string }>> = {
    electrical: [
      { label: "Foto rough-in eléctrico",   kind: "photo",    description: "Cables y cajas antes de cerrar paredes" },
      { label: "Prueba GFCI documentada",   kind: "test",     description: "Foto del botón test/reset activado" },
      { label: "Etiquetas panel completas", kind: "photo",    description: "Panel con todos los breakers etiquetados" },
    ],
    plumbing: [
      { label: "Foto tubería instalada",    kind: "photo",    description: "Tuberías antes de cubrir" },
      { label: "Prueba de presión",          kind: "test",     description: "Manómetro durante 30 min" },
      { label: "Foto fixtures terminados",  kind: "photo",    description: "Griferías instaladas" },
    ],
    drywall: [
      { label: "Foto instalación paneles",  kind: "photo",    description: "Antes de aplicar compound" },
      { label: "Foto acabado listo pintar", kind: "photo",    description: "Superficie lista para pintura" },
    ],
    painting: [
      { label: "Foto antes de pintar",      kind: "photo",    description: "Estado inicial de la superficie" },
      { label: "Foto primer aplicado",      kind: "photo",    description: "Primer en zona preparada" },
      { label: "Foto acabado final",        kind: "photo",    description: "Resultado final de pintura" },
    ],
    carpentry: [
      { label: "Foto ensamble y nivelación", kind: "photo",    description: "Estructura principal alineada y fija" },
      { label: "Foto colocación de herrajes", kind: "photo",    description: "Bisagras, cajones y tiradores en funcionamiento" },
      { label: "Foto acabado final aplicado", kind: "photo",    description: "Superficie barnizada o pintada con detalle de uniones" },
    ],
  };
  const required = templates[trade.toLowerCase()] ?? [
    { label: "Foto antes de empezar", kind: "photo", description: "Estado inicial del área" },
    { label: "Foto trabajo terminado", kind: "photo", description: "Resultado final del trabajo" },
  ];
  return {
    milestoneTitle: trade,
    required,
    disputeRisk: required.length > 3 ? "high" : "medium",
  };
}
