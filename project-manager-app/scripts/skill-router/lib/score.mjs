// Step 4 of the routing algorithm (05_ROUTING_ALGORITHM.md):
//
//   exact trigger match         +40
//   scope/capability match      +30
//   active phase match          +15
//   explicit repository mention +10
//   specificity tie-breaker     +0..5
//   exclude match               -100
//   deprecated                  -30
//
// A *declared* trigger (explicit routing.triggers) counts at full weight.
// An *inferred* trigger (legacy skill, no routing: metadata — see
// registry.mjs) counts at the weaker "explicit mention" weight, since it
// was never actually declared as a routing trigger by the skill's author.

const DECLARED_TRIGGER_WEIGHT = 40;
const INFERRED_TRIGGER_WEIGHT = 10;
const SCOPE_WEIGHT = 30;
const PHASE_WEIGHT = 15;
const MENTION_WEIGHT = 10;
const EXCLUDE_PENALTY = -100;
const DEPRECATED_PENALTY = -30;
const MAX_TRIGGER_HITS_COUNTED = 3;
const MAX_SCOPE_HITS_COUNTED = 2;

function includesPhrase(haystackLower, phrase) {
  if (!phrase) return false;
  const normalized = phrase.toLowerCase().replace(/_/g, " ");
  return haystackLower.includes(normalized) || haystackLower.includes(phrase.toLowerCase());
}

export function scoreSkillAgainstTask({ skill, taskTextLower, classification }) {
  const routing = skill.routing;
  const reasons = [];
  let score = 0;

  if (routing.status === "deprecated") {
    score += DEPRECATED_PENALTY;
    reasons.push(`deprecated (${DEPRECATED_PENALTY})`);
  }

  const triggerWeight = routing.inferred ? INFERRED_TRIGGER_WEIGHT : DECLARED_TRIGGER_WEIGHT;
  const triggerHits = routing.triggers.filter((trig) => includesPhrase(taskTextLower, trig)).length;
  if (triggerHits > 0) {
    const gained = Math.min(triggerHits, MAX_TRIGGER_HITS_COUNTED) * triggerWeight;
    score += gained;
    reasons.push(`${routing.inferred ? "inferred" : "declared"} trigger match x${triggerHits} (+${gained})`);
  }

  const scopeHits = routing.scope.filter((s) => includesPhrase(taskTextLower, s)).length;
  if (scopeHits > 0) {
    const gained = Math.min(scopeHits, MAX_SCOPE_HITS_COUNTED) * SCOPE_WEIGHT;
    score += gained;
    reasons.push(`scope match x${scopeHits} (+${gained})`);
  }

  if (routing.phases.length > 0 && routing.phases.includes(classification.phase)) {
    score += PHASE_WEIGHT;
    reasons.push(`phase match (${classification.phase}) (+${PHASE_WEIGHT})`);
  }

  if (includesPhrase(taskTextLower, skill.id) || includesPhrase(taskTextLower, skill.name)) {
    score += MENTION_WEIGHT;
    reasons.push(`explicit skill/repository mention (+${MENTION_WEIGHT})`);
  }

  const specificity = typeof routing.specificity === "number" ? routing.specificity : 0;
  const specBonus = Math.max(0, Math.min(5, Math.round(specificity / 20)));
  if (specBonus > 0) {
    score += specBonus;
    reasons.push(`specificity tie-breaker (+${specBonus})`);
  }

  const excludeHits = routing.excludes.filter((ex) => includesPhrase(taskTextLower, ex));
  if (excludeHits.length > 0) {
    score += EXCLUDE_PENALTY;
    reasons.push(`exclude match "${excludeHits.join(", ")}" (${EXCLUDE_PENALTY})`);
  }

  return { score, reasons };
}
