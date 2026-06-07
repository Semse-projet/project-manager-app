import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type {
  DeveloperRuntimeArtifact,
  DeveloperRuntimeExecutionStep,
  DeveloperRuntimeMission,
  DeveloperRuntimeSessionLog,
  DeveloperRuntimeValidationResult,
} from "@semse/schemas";

function nowIso() {
  return new Date().toISOString();
}

@Injectable()
export class DeveloperRuntimeValidationService {
  buildPlanningArtifacts(mission: DeveloperRuntimeMission): DeveloperRuntimeArtifact[] {
    return [
      {
        id: randomUUID(),
        sessionId: mission.sessionId,
        type: "report",
        label: "mission-plan",
        contentSnippet: JSON.stringify({
          missionId: mission.id,
          category: mission.intent.category,
          riskLevel: mission.riskLevel,
          steps: mission.plan.map((step) => ({
            order: step.order,
            title: step.title,
            tool: step.tool,
            agent: step.agent,
          })),
        }),
        createdAt: nowIso(),
      },
    ];
  }

  buildPlanningLogs(mission: DeveloperRuntimeMission): DeveloperRuntimeSessionLog[] {
    return [
      {
        id: randomUUID(),
        sessionId: mission.sessionId,
        timestamp: nowIso(),
        agent: "diagnostic-agent",
        tool: "searchCode",
        action: "intent.interpreted",
        inputSummary: mission.intent.goal,
        outputSummary: `Intent classified as ${mission.intent.category} with risk ${mission.intent.riskLevel}.`,
        status: "ok",
      },
      {
        id: randomUUID(),
        sessionId: mission.sessionId,
        timestamp: nowIso(),
        agent: "architect-agent",
        tool: "readFile",
        action: "plan.created",
        inputSummary: `Mission ${mission.id} generated for ${mission.intent.repoId}.`,
        outputSummary: `${mission.plan.length} steps planned.`,
        status: "ok",
      },
    ];
  }

  deriveValidationNames(plan: DeveloperRuntimeExecutionStep[]): string[] {
    const names = new Set<string>();

    for (const step of plan) {
      if (step.tool === "runBuild") names.add("build");
      if (step.tool === "runLint") names.add("lint");
      if (step.tool === "runTests") names.add("tests");
    }

    if (names.size === 0) {
      names.add("structural-review");
    }

    return Array.from(names);
  }

  buildPreview(mission: DeveloperRuntimeMission): DeveloperRuntimeValidationResult[] {
    return this.deriveValidationNames(mission.plan).map((name) => ({
      id: randomUUID(),
      sessionId: mission.sessionId,
      name,
      status: "skipped",
      details: `Preview generated at ${nowIso()} before runtime execution.`,
    }));
  }
}
