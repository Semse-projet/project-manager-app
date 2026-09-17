// Orchestrates classify -> governance/execution lanes -> scored
// domain/support selection -> explainable decision record.
//
// Governance and execution are selected independently of the domain/support
// scoring pass (Routing Refinement 1: "separate lanes, not one priority
// ladder") so a broad governance skill can never crowd out a precise
// domain skill from `primary`, and vice versa a domain skill can never
// suppress a governance requirement.

import { randomUUID, createHash } from "node:crypto";
import { classifyTask } from "./classify.mjs";
import { scoreSkillAgainstTask } from "./score.mjs";

const CONFIDENCE_FLOOR = 15;
const MAX_SUPPORTING = 2;
const SUPPORTING_RATIO_OF_PRIMARY = 0.4;

export function route(taskText, registry, options = {}) {
  const taskTextLower = taskText.toLowerCase();
  const classification = classifyTask(taskText);
  const bySkillId = new Map(registry.skills.map((s) => [s.id, s]));

  const governance = [];
  const reasons = [];

  if (classification.needsSemseproject && bySkillId.has("semseproject")) {
    governance.push("semseproject");
    reasons.push(`governance=semseproject: ${classification.governanceReason}`);
  }
  if (classification.needsAuditRemediation && bySkillId.has("semse-audit-remediation")) {
    governance.push("semse-audit-remediation");
    reasons.push("governance=semse-audit-remediation: task references the audit-remediation backlog");
  }

  const execution = [];
  if (classification.needsAAA && bySkillId.has("aaa-zoom-loop-execution")) {
    execution.push("aaa-zoom-loop-execution");
    reasons.push(`execution=aaa-zoom-loop-execution: scope classified ${classification.scope}`);
  }

  const lanesOnly = new Set([...governance, ...execution]);

  const scored = [];
  for (const skill of registry.skills) {
    if (lanesOnly.has(skill.id)) continue;
    const { score, reasons: skillReasons } = scoreSkillAgainstTask({ skill, taskTextLower, classification });
    scored.push({ id: skill.id, score, reasons: skillReasons, category: skill.routing.category });
  }
  scored.sort((a, b) => b.score - a.score);

  let primary = null;
  const supporting = [];
  const warnings = [];
  const excluded = [];

  if (scored.length > 0 && scored[0].score >= CONFIDENCE_FLOOR) {
    primary = scored[0].id;
    reasons.push(`primary=${primary} score=${scored[0].score}: ${scored[0].reasons.join("; ") || "no positive signal"}`);

    for (const cand of scored.slice(1)) {
      const qualifies = cand.score >= CONFIDENCE_FLOOR && cand.score >= scored[0].score * SUPPORTING_RATIO_OF_PRIMARY;
      if (qualifies && supporting.length < MAX_SUPPORTING) {
        supporting.push(cand.id);
        reasons.push(`supporting=${cand.id} score=${cand.score}: ${cand.reasons.join("; ") || "no positive signal"}`);
      } else {
        excluded.push({
          id: cand.id,
          reason: qualifies
            ? `score ${cand.score} qualified but supporting cap (${MAX_SUPPORTING}) reached`
            : `score ${cand.score} below supporting threshold`,
        });
      }
    }
  } else {
    warnings.push("NO_CONFIDENT_DOMAIN_SKILL: no domain/support skill scored above the confidence floor; continue under repository contracts");
    for (const cand of scored) {
      excluded.push({ id: cand.id, reason: `score ${cand.score} below confidence floor ${CONFIDENCE_FLOOR}` });
    }
  }

  if (registry.duplicates?.length > 0) {
    for (const dup of registry.duplicates) {
      warnings.push(`DUPLICATE_SKILL_ID: "${dup.id}" found in multiple roots (${dup.locations.map((l) => l.root).join(", ")})`);
    }
  }

  const confidence = scored.length > 0 ? Math.max(0, Math.min(1, scored[0].score / 100)) : 0;

  return {
    decision_id: `route-${randomUUID()}`,
    timestamp: new Date().toISOString(),
    task_fingerprint: createHash("sha256").update(taskText).digest("hex").slice(0, 16),
    phase: classification.phase,
    governance,
    execution,
    primary,
    supporting,
    confidence,
    reasons,
    warnings,
    excluded,
    classification,
    human_override: options.humanOverride ?? null,
  };
}
