/**
 * Prometeo Agro — extracción determinista (reglas, sin LLM) de reportes de
 * campo. Convierte texto (o la transcripción de un audio) en una propuesta
 * estructurada. NUNCA persiste ni diagnostica: la propuesta siempre requiere
 * revisión humana y se confirma por los endpoints normales.
 *
 * Principio: buscar → relacionar → completar → crear.
 * Spec: docs/specs/agro/agro-prometeo-intake.spec.md
 */
import { AGRO_INCIDENT_CATEGORY, suggestedSeverity, type AgroIncidentType } from "./agro-incident.domain.js";

export const AGRO_INTAKE_ENGINE = "agro-intake-rules-v1";

export const AGRO_INTAKE_DISCLAIMER =
  "Prometeo estructura el reporte y sugiere una clasificación operativa. No emite diagnósticos " +
  "veterinarios ni agronómicos: la severidad y cualquier evaluación deben confirmarlas personas autorizadas.";

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9#\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Clasificación de incidencias ────────────────────────────────────────────

const INCIDENT_RULES: Array<{ type: AgroIncidentType; patterns: RegExp[] }> = [
  { type: "ANIMAL_MORTALITY", patterns: [/\bmuert[oa]s?\b/, /\bmurio\b/, /\bfallecio\b/, /\bamanecio muert/] },
  { type: "ANIMAL_INJURY", patterns: [/\bherid[oa]s?\b/, /\bherida\b/, /\blesion/, /\bcoje(a|ando)\b/, /\bcojo\b/, /\bsangr/, /\bgolpe(ado)?\b/, /\bcortad[oa]\b/, /\bfractur/] },
  { type: "ANIMAL_ILLNESS_OBSERVED", patterns: [/\benferm[oa]s?\b/, /\bdiarrea\b/, /\btos(e|iendo)?\b/, /\bfiebre\b/, /\bno (quiere )?come\b/, /\bdecaid[oa]\b/, /\bvomit/, /\bmoquillo\b/, /\bhinchad[oa]\b/] },
  { type: "ANIMAL_ESCAPE", patterns: [/\bescap(o|aron|ado|ada)\b/, /\bse salio\b/, /\bse salieron\b/, /\bsuelt[oa]s?\b/, /\bse perdio\b/] },
  { type: "WATER_SHORTAGE", patterns: [/\bfalta(n)? (de )?agua\b/, /\bsin agua\b/, /\bno (hay|tiene|tienen) agua\b/, /\bbebederos? (sec|vaci)/, /\bse acabo el agua\b/] },
  { type: "FEED_SHORTAGE", patterns: [/\bfalta(n)? (de )?(alimento|comida|concentrado|pienso|maiz|pasto)\b/, /\bsin (alimento|comida|concentrado|pienso)\b/, /\bse acabo el (alimento|concentrado|pienso)\b/] },
  { type: "BIOSECURITY_RISK", patterns: [/\bbioseguridad\b/, /\bcontamin/, /\bsin desinfect/, /\bpediluvio\b/, /\banimales? (ajen|extran)/] },
  { type: "INFRASTRUCTURE_DAMAGE", patterns: [/\bcerca (rota|caida|danada)\b/, /\b(techo|puerta|malla|corral|comedero|galpon) (rot|danad|caid)/, /\bse cayo (el|la) (techo|cerca|pared)\b/] },
  { type: "IRRIGATION_FAILURE", patterns: [/\briego\b/, /\baspersor/, /\bgoteo\b/, /\bmanguera (rota|danada)\b/, /\bfertirriego\b/] },
  { type: "EQUIPMENT_FAILURE", patterns: [/\btractor\b/, /\bbomba\b/, /\bmaquina\b/, /\bno arranca\b/, /\bmotor\b/, /\bplanta electrica\b/, /\bse dano (el|la) (equipo|motor|bomba)\b/] },
  { type: "PEST_OBSERVED", patterns: [/\bplaga\b/, /\bgusano/, /\borugas?\b/, /\bpulgon/, /\bratas?\b/, /\broedores?\b/, /\blangosta\b/, /\bhormigas?\b/] },
  { type: "CROP_DAMAGE", patterns: [/\bcultivo/, /\bplantas? (danad|quemad|sec|caid)/, /\bcosecha (danad|perdid)/, /\bgranizo\b/, /\bhelada\b/] },
  { type: "SAFETY_HAZARD", patterns: [/\bpeligro/, /\bcable (suelto|pelado)\b/, /\belectric/, /\baccidente\b/, /\bresbal/, /\bse lastimo\b/] },
];

export function classifyIncident(normalized: string): { type: AgroIncidentType; score: number; matched: string[] } | null {
  let best: { type: AgroIncidentType; score: number; matched: string[] } | null = null;
  for (const rule of INCIDENT_RULES) {
    const matched = rule.patterns.filter((p) => p.test(normalized)).map((p) => p.source);
    if (matched.length > 0 && (!best || matched.length > best.score)) {
      best = { type: rule.type, score: matched.length, matched };
    }
  }
  return best;
}

// ── Reporte de tarea hecha ("ya alimenté…") ─────────────────────────────────

const COMPLETION_RULES: Array<{ taskType: string; pattern: RegExp }> = [
  { taskType: "FEEDING", pattern: /\b(ya )?(aliment[eo]|di de comer|le di (de )?comer|les di (de )?comer|eche (el )?(alimento|concentrado))\b/ },
  { taskType: "CLEANING", pattern: /\b(ya )?(limpie|lave|desinfecte)\b/ },
  { taskType: "VACCINATION", pattern: /\b(ya )?(vacune|aplique la vacuna)\b/ },
  { taskType: "WEIGHING", pattern: /\b(ya )?pese\b/ },
  { taskType: "WATER_CHECK", pattern: /\b(ya )?(revise|llene) (el |los )?(agua|bebederos?)\b/ },
  { taskType: "INSPECTION", pattern: /\b(ya )?(revise|inspeccione)\b/ },
  { taskType: "MOVEMENT", pattern: /\b(ya )?(movi|pase|traslade)\b/ },
  { taskType: "TREATMENT", pattern: /\b(ya )?(cure|trate|aplique (el )?(tratamiento|medicamento))\b/ },
];

export function detectCompletion(normalized: string): { taskType: string } | null {
  const done = /\b(ya|termine|listo|hecho|acabe)\b/.test(normalized);
  for (const rule of COMPLETION_RULES) {
    if (rule.pattern.test(normalized) && (done || /\b(aliment[eo]|limpie|vacune|pese|cure)\b/.test(normalized))) {
      return { taskType: rule.taskType };
    }
  }
  return null;
}

// ── Entidades ───────────────────────────────────────────────────────────────

const SPECIES_WORDS: Array<{ species: string; pattern: RegExp }> = [
  { species: "PIG", pattern: /\b(cerd[oa]s?|cerdit[oa]s?|lechon(es|cito)?|marran[oa]s?|puerc[oa]s?|cochin[oa]s?)\b/ },
  { species: "CATTLE", pattern: /\b(vacas?|terner[oa]s?|tor[oa]s?|novill[oa]s?|becerr[oa]s?|res(es)?|ganado)\b/ },
  { species: "CHICKEN", pattern: /\b(gallinas?|pollos?|pollitos?|aves?)\b/ },
  { species: "GOAT", pattern: /\b(cabras?|chivos?)\b/ },
  { species: "SHEEP", pattern: /\b(ovejas?|borregos?|corderos?)\b/ },
  { species: "HORSE", pattern: /\b(caballos?|yeguas?|potros?)\b/ },
];

export function detectSpecies(normalized: string): string | null {
  return SPECIES_WORDS.find((s) => s.pattern.test(normalized))?.species ?? null;
}

/** Referencias tipo "lote 15", "corral 8", "potrero norte" presentes en el texto. */
export function extractNumberedRefs(normalized: string): Array<{ kind: string; ref: string }> {
  const refs: Array<{ kind: string; ref: string }> = [];
  const re = /\b(lote|grupo|corral|potrero|galpon|nave|sala|jaula|parcela|bloque|cuadra|modulo)\s+(?:(?:n|no|numero)\s+)?([a-z0-9]+)\b/g;
  for (const m of normalized.matchAll(re)) refs.push({ kind: m[1]!, ref: m[2]! });
  return refs;
}

export type IntakeCandidate = { id: string; name: string; kind: "FARM_UNIT" | "ANIMAL_GROUP" | "ANIMAL" };

/**
 * Relaciona nombres/etiquetas reales de la finca con el texto.
 * 0.95: el nombre completo aparece en el texto. 0.8: coincide "tipo + número"
 * ("lote 15" ↔ grupo "Lote 15 engorde"). 0.9: etiqueta de animal (#123 / 123).
 */
export function matchEntities(normalized: string, candidates: IntakeCandidate[]) {
  const refs = extractNumberedRefs(normalized);
  const tokens = new Set(normalized.split(" "));
  const matches: Array<IntakeCandidate & { confidence: number; reason: string }> = [];
  for (const c of candidates) {
    const name = normalizeText(c.name);
    if (!name) continue;
    if (c.kind === "ANIMAL") {
      const tag = name.replace(/^#/, "");
      if (tag.length >= 2 && (tokens.has(tag) || tokens.has(`#${tag}`))) {
        matches.push({ ...c, confidence: 0.9, reason: `etiqueta ${c.name}` });
      }
      continue;
    }
    if (name.length >= 3 && new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(normalized)) {
      matches.push({ ...c, confidence: 0.95, reason: `nombre "${c.name}"` });
      continue;
    }
    const nameTokens = name.split(" ");
    const ref = refs.find((r) => nameTokens.includes(r.kind) && nameTokens.includes(r.ref));
    if (ref) matches.push({ ...c, confidence: 0.8, reason: `${ref.kind} ${ref.ref}` });
  }
  return matches.sort((a, b) => b.confidence - a.confidence);
}

export function buildIncidentTitle(type: AgroIncidentType, text: string): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  return trimmed.length <= 120 ? trimmed : `${trimmed.slice(0, 117)}…`;
}

export function incidentProposalBase(type: AgroIncidentType) {
  return {
    type,
    category: AGRO_INCIDENT_CATEGORY[type],
    suggestedSeverity: suggestedSeverity(type),
    severityConfirmed: false as const,
  };
}

/**
 * Puntúa una tarea abierta contra lo reportado: tipo (+0.5), objetivo
 * relacionado (+0.4), palabras del título (+0.1).
 */
export function scoreTaskMatch(
  task: { type: string | null; targetType: string | null; targetId: string | null; title: string },
  input: { taskType: string; entityIds: Set<string>; normalized: string },
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  if (task.type === input.taskType) { score += 0.5; reasons.push(`tipo ${task.type}`); }
  if (task.targetId && input.entityIds.has(task.targetId)) { score += 0.4; reasons.push("mismo corral/lote/animal"); }
  const titleTokens = normalizeText(task.title).split(" ").filter((t) => t.length > 3);
  if (titleTokens.some((t) => input.normalized.includes(t))) { score += 0.1; reasons.push("coincide el título"); }
  return { score: Math.round(score * 100) / 100, reasons };
}
