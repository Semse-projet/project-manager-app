import { apiFetch } from "./client";

/**
 * T-055 — Agro en mobile, primer corte (spec docs/specs/agro/agro-mobile-report.spec.md):
 * lista de fincas, reportar incidencia (intake Prometeo: propone, nunca escribe —
 * la persona confirma), y ver incidencias. La finca se identifica por
 * `farmId` en cada llamada, igual que el resto de endpoints Agro.
 */

export type AgroFarmMembership = {
  farmId: string;
  farmName: string;
  farmRole: string;
};

export type AgroIncident = {
  id: string;
  type: string;
  severity: string;
  status: string;
  title: string;
  description: string | null;
  detectedAt: string;
  occurredAt: string | null;
};

export type AgroIntakeVisionCandidate = { slug: string | null; label: string | null; confidence: number };
export type AgroIntakeVisionSignal = { evidenceId: string; provider: string; model: string; candidates: AgroIntakeVisionCandidate[] };

/**
 * Solo los campos que la pantalla de reporte necesita mostrar/confirmar — el
 * shape real de `AgroIntakeService.propose()` trae más detalle (taskMatches,
 * entities, etc.) que esta v1 de mobile no usa todavía.
 */
export type AgroIntakeProposal = {
  intent: "INCIDENT" | "TASK_COMPLETION" | "UNKNOWN";
  confidence: number;
  disclaimer: string;
  requiresHumanReview: true;
  transcribedFrom: string[];
  visionSignals: AgroIntakeVisionSignal[];
  incident?: {
    type: string;
    suggestedSeverity: string;
    severityConfirmed: boolean;
    title: string;
    description: string;
    relations: { farmUnitId: string | null; animalGroupId: string | null; animalId: string | null };
  };
  duplicateCandidates?: Array<{ id: string; title: string; status: string; severity: string }>;
  recommendedAction:
    | { kind: "CREATE_INCIDENT" }
    | { kind: "LINK_EXISTING_INCIDENT"; incidentId: string; alternative: "CREATE_INCIDENT" }
    | { kind: "ASK_HUMAN"; question: string }
    | { kind: "COMPLETE_TASK" }
    | { kind: "CREATE_TASK" };
};

/**
 * `GET /v1/agro/memberships` solo devuelve fincas donde el usuario es
 * `AgroFarmMember` ACTIVE — a propósito no incluye fincas que el usuario
 * posee como `AgroFarm.ownerId` sin ser también miembro (ver
 * AgroFarmAccessService.listMemberships). Encaja con el público de este
 * primer corte (trabajadores de campo reportando), no con el dueño viendo
 * su propia finca desde el celular — gap documentado, no silencioso.
 */
export async function fetchAgroMemberships(): Promise<AgroFarmMembership[]> {
  const result = await apiFetch<{ memberships: Array<{ farmId: string; role: string; farm: { id: string; name: string } }> }>(
    "/v1/agro/memberships",
  );
  return result.memberships.map((m) => ({ farmId: m.farmId, farmName: m.farm.name, farmRole: m.role }));
}

export async function fetchAgroIncidents(farmId: string): Promise<AgroIncident[]> {
  const result = await apiFetch<{ viewerRole: string; incidents: AgroIncident[] }>(
    `/v1/agro/farms/${encodeURIComponent(farmId)}/incidents`,
  );
  return result.incidents;
}

/**
 * Nunca persiste — `requiresHumanReview: true` siempre. La pantalla debe
 * mostrar la propuesta y pedir confirmación antes de llamar a
 * `createAgroIncident`.
 */
export async function proposeAgroIntake(
  farmId: string,
  input: { text?: string; evidenceIds?: string[] },
): Promise<{ proposal: AgroIntakeProposal }> {
  return apiFetch<{ proposal: AgroIntakeProposal }>(`/v1/agro/farms/${encodeURIComponent(farmId)}/intake/propose`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function createAgroIncident(
  farmId: string,
  input: {
    type: string;
    severity?: string;
    title: string;
    description?: string;
    source?: string;
    evidence?: Array<{ mediaType: string; title?: string; note?: string; fileUrl?: string }>;
  },
): Promise<{ incident: AgroIncident }> {
  return apiFetch<{ incident: AgroIncident }>(`/v1/agro/farms/${encodeURIComponent(farmId)}/incidents`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}
