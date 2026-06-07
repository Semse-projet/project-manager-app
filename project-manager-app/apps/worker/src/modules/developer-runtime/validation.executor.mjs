import { randomUUID } from "node:crypto";

function nowIso() {
  return new Date().toISOString();
}

export function buildValidationArtifacts({
  sessionId,
  stepId,
  validationName,
  result,
}) {
  return [{
    id: randomUUID(),
    sessionId,
    stepId,
    type: "command_output",
    label: `${validationName}-output`,
    contentSnippet: `${result.stdout}${result.stderr ? `\n${result.stderr}` : ""}`.trim().slice(0, 4000),
    createdAt: nowIso(),
  }];
}

export function buildValidationResults({
  sessionId,
  stepId,
  validationName,
  result,
}) {
  return [{
    id: randomUUID(),
    sessionId,
    stepId,
    name: validationName,
    status: result.ok ? "passed" : "failed",
    details: result.ok
      ? "Worker validation finished successfully."
      : (result.stderr || "Validation failed."),
  }];
}
