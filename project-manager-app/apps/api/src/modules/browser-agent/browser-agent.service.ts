import { Injectable, Logger, BadRequestException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { AgentsService } from "../agents/agents.service.js";
import { AiModelGatewayService } from "../ai-models/gateway/ai-model-gateway.service.js";
import { EvidenceGatewayService } from "../evidence-gateway/evidence-gateway.service.js";
import { InspectUrlDto } from "./dto/inspect-url.dto.js";
import { URL } from "node:url";

export function isUrlSafe(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return false;
    }

    const host = url.hostname.toLowerCase();

    // Loopback hostnames
    if (host === "localhost" || host.endsWith(".localhost") || host === "loopback") {
      return false;
    }

    // Direct loopback IPs
    if (host === "127.0.0.1" || host === "::1" || host === "0.0.0.0" || host === "::") {
      return false;
    }

    // Basic IPv4 private ranges check
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const ipv4Match = host.match(ipv4Regex);
    if (ipv4Match) {
      const p0 = parseInt(ipv4Match[1], 10);
      const p1 = parseInt(ipv4Match[2], 10);
      
      // Loopback: 127.0.0.0/8
      if (p0 === 127) return false;
      // 0.0.0.0/8
      if (p0 === 0) return false;
      // Private Class A: 10.0.0.0/8
      if (p0 === 10) return false;
      // Private Class B: 172.16.0.0/12
      if (p0 === 172 && p1 >= 16 && p1 <= 31) return false;
      // Private Class C: 192.168.0.0/16
      if (p0 === 192 && p1 === 168) return false;
      // Link-local: 169.254.0.0/16
      if (p0 === 169 && p1 === 254) return false;
      // Shared space: 100.64.0.0/10
      if (p0 === 100 && p1 >= 64 && p1 <= 127) return false;
    }

    // Basic IPv6 private prefixes
    if (
      host.startsWith("fe8") ||
      host.startsWith("fe9") ||
      host.startsWith("fea") ||
      host.startsWith("feb") ||
      host.startsWith("fc") ||
      host.startsWith("fd")
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

@Injectable()
export class BrowserAgentService {
  private readonly logger = new Logger(BrowserAgentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly agentsService: AgentsService,
    private readonly aiGateway: AiModelGatewayService,
    private readonly evidenceGateway: EvidenceGatewayService,
  ) {}

  async createInspection(
    dto: InspectUrlDto,
    context: { tenantId: string; orgId: string; userId: string; roles: string[]; requestId: string },
  ) {
    if (!isUrlSafe(dto.url)) {
      throw new BadRequestException(`URL is blocked or unsafe to inspect: ${dto.url}`);
    }

    const correlationId = `browser-inspect-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    // Create the AgentRun using the standard agents framework
    const run = await this.agentsService.create({
      tenantId: context.tenantId,
      orgId: context.orgId,
      userId: context.userId,
      roles: context.roles,
      agentType: "browser-agent",
      triggerType: "manual",
      correlationId,
      input: {
        url: dto.url,
        includeScreenshot: dto.includeScreenshot !== false,
        includeText: dto.includeText !== false,
        includeAiSummary: dto.includeAiSummary !== false,
        projectId: dto.projectId,
        milestoneId: dto.milestoneId,
      },
      inputSummary: `Inspección web de URL: ${dto.url}`,
      requestId: context.requestId,
    });

    return {
      runId: run.id,
      status: run.status,
      correlationId,
    };
  }

  async getInspectionResult(
    runId: string,
    context: { tenantId: string; orgId: string; userId: string },
  ) {
    // Get the run using agentsService
    const run = await this.agentsService.detail({
      tenantId: context.tenantId,
      orgId: context.orgId,
      userId: context.userId,
      runId,
    });

    if (!run) {
      throw new NotFoundException(`Browser agent run ${runId} not found`);
    }

    // Return current status if not completed
    if (run.status !== "completed") {
      return {
        runId: run.id,
        status: run.status,
        url: (run.input as any)?.url,
        projectId: (run.input as any)?.projectId,
        milestoneId: (run.input as any)?.milestoneId,
        createdAt: run.createdAt,
      };
    }

    const output = (run.output as any) || {};
    const result = output.result || {};
    
    // Check if we need to generate an AI summary (if not already done and it was requested)
    const shouldSummary = (run.input as any)?.includeAiSummary !== false;
    const hasSummary = !!output.aiSummary;

    if (shouldSummary && !hasSummary && result.success) {
      try {
        const aiSummary = await this.generateAiSummary(result, context.userId, (run.input as any)?.projectId);
        
        // Save the AI summary back into the run's output so it's cached
        const updatedOutput = {
          ...output,
          aiSummary,
        };

        await this.prisma.agentRun.update({
          where: { id: run.id },
          data: {
            outputJson: updatedOutput as any,
          },
        });

        output.aiSummary = aiSummary;

        // If a projectId is provided, also upload this as evidence
        const projectId = (run.input as any)?.projectId;
        if (projectId) {
          try {
            await this.saveAsEvidence(projectId, (run.input as any)?.milestoneId, context.tenantId, context.userId, result, aiSummary);
          } catch (evidenceError) {
            this.logger.error("Failed to automatically upload inspection to Evidence Gateway", evidenceError);
          }
        }
      } catch (aiError) {
        this.logger.error("Failed to generate AI summary for browser inspection", aiError);
      }
    }

    return {
      runId: run.id,
      status: run.status,
      url: (run.input as any)?.url,
      projectId: (run.input as any)?.projectId,
      milestoneId: (run.input as any)?.milestoneId,
      success: result.success,
      finalUrl: result.finalUrl,
      title: result.title,
      pageStatus: result.status,
      severity: result.severity,
      loadTimeMs: result.loadTimeMs,
      consoleErrors: result.consoleErrors || [],
      networkFailures: result.networkFailures || [],
      visibleTextSample: result.visibleTextSample,
      screenshotBase64: result.screenshotBase64,
      aiSummary: output.aiSummary,
      createdAt: run.createdAt,
      completedAt: run.endedAt,
    };
  }

  private async generateAiSummary(result: any, userId: string, projectId?: string) {
    const systemPrompt = `You are the SEMSE Web Intelligence Agent.
Your job is to analyze the raw output of a browser web inspection run and produce a structured assessment.

You MUST return your output in JSON format with the following fields:
{
  "summary_es": "Un resumen claro en español para el usuario sobre qué funciona y qué fallas se detectaron.",
  "summary_en": "A technical English summary explaining developer-level diagnostics.",
  "severity": "low" | "medium" | "high" | "critical",
  "recommendations": ["lista de recomendaciones o pasos a seguir para solucionar los problemas"],
  "github_issue_body": "Optional Markdown description suitable for creating a GitHub issue if bugs or console errors exist.",
  "claude_fix_prompt": "Optional detailed prompt for Claude or Codex to fix the specific codebase parts causing this bug."
}`;

    const inputMsg = `Raw inspection output:
URL: ${result.url}
Final URL: ${result.finalUrl}
Page Title: ${result.title}
Page Status: ${result.status}
Severity Class: ${result.severity}
Load Time: ${result.loadTimeMs}ms

Console Errors count: ${result.consoleErrors?.length || 0}
${JSON.stringify(result.consoleErrors || [])}

Network Failures count: ${result.networkFailures?.length || 0}
${JSON.stringify(result.networkFailures || [])}

Visible Text Sample:
${result.visibleTextSample || "(None extracted)"}
`;

    const response = await this.aiGateway.generate({
      userId,
      projectId,
      taskType: "document_summary",
      input: inputMsg,
      systemPrompt,
    });

    if (!response.success || !response.output) {
      throw new Error(`AI generation failed: ${response.errorMessage || "no response"}`);
    }

    try {
      // Find JSON block or parse directly
      const cleanOutput = response.output.trim();
      const jsonStart = cleanOutput.indexOf("{");
      const jsonEnd = cleanOutput.lastIndexOf("}");
      if (jsonStart !== -1 && jsonEnd !== -1) {
        return JSON.parse(cleanOutput.substring(jsonStart, jsonEnd + 1));
      }
      return JSON.parse(cleanOutput);
    } catch (_parseError) {
      // Return fallback structured object if parsing fails
      return {
        summary_es: "La IA generó una respuesta que no pudo ser parseada como JSON: " + response.output.slice(0, 300),
        summary_en: "AI generated a non-JSON output.",
        severity: result.severity,
        recommendations: ["Revisar los registros de la consola manualmente."],
      };
    }
  }

  private async saveAsEvidence(
    projectId: string,
    milestoneId: string | undefined,
    tenantId: string,
    userId: string,
    result: any,
    aiSummary: any,
  ) {
    const bucketKey = `browser-agent/screenshot-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.png`;

    await this.evidenceGateway.uploadEvidence({
      tenantId,
      projectId,
      milestoneId,
      uploadedById: userId,
      kind: "DOCUMENT",
      bucketKey,
      metadataJson: {
        source: "browser-agent",
        url: result.url,
        finalUrl: result.finalUrl,
        title: result.title,
        status: result.status,
        severity: result.severity,
        loadTimeMs: result.loadTimeMs,
        consoleErrorsCount: result.consoleErrors?.length || 0,
        networkFailuresCount: result.networkFailures?.length || 0,
        aiSummary,
        // Save base64 screenshot in metadata
        screenshotBase64: result.screenshotBase64,
      },
    });
  }

  async createMission(data: { tenantId: string; actorId: string; goal: string; steps: any[] }) {
    const mission = await this.prisma.browserMission.create({
      data: {
        tenantId: data.tenantId,
        actorId: data.actorId,
        goal: data.goal,
        status: "PLANNED",
        budgetLimit: 100.0,
      }
    });

    const steps = await Promise.all(
      data.steps.map((step, idx) =>
        this.prisma.browserMissionStep.create({
          data: {
            missionId: mission.id,
            stepNumber: idx + 1,
            actionType: step.actionType,
            parameters: step.parameters || {},
            engineUsed: step.engineUsed || "PLAYWRIGHT",
            status: "PENDING"
          }
        })
      )
    );

    // Create the background AgentRun to execute the mission
    const correlationId = `browser-mission-${mission.id}-${Date.now()}`;
    const run = await this.agentsService.create({
      tenantId: data.tenantId,
      orgId: data.actorId,
      userId: data.actorId,
      roles: ["project_manager"],
      agentType: "browser-agent",
      triggerType: "manual",
      correlationId,
      input: {
        missionId: mission.id,
      },
      inputSummary: `Ejecución de misión browser: ${data.goal}`,
      requestId: correlationId,
    });

    return { missionId: mission.id, runId: run.id, stepsCount: steps.length };
  }

  // tenantId is required on all three methods below — createMission always
  // stamps it, but these lookups/updates previously didn't filter by it,
  // letting any authenticated actor (agents:run:create is shared by
  // CLIENT/PRO/WORKER/OPS_ADMIN) read or overwrite another tenant's mission
  // by guessing/enumerating its id. See docs/AUDIT_REMEDIATION_PLAN.md 3.12.
  async getMission(id: string, tenantId: string) {
    const mission = await this.prisma.browserMission.findFirst({
      where: { id, tenantId },
      // Las sesiones de navegador viven en memoria (BrowserSessionPool),
      // no hay modelo persistido de sesión que incluir.
      include: { steps: true }
    });
    if (!mission) throw new NotFoundException("Mission not found");
    return mission;
  }

  async updateMission(id: string, tenantId: string, body: any) {
    const { count } = await this.prisma.browserMission.updateMany({
      where: { id, tenantId },
      data: { status: body.status }
    });
    if (count === 0) throw new NotFoundException("Mission not found");
    return this.prisma.browserMission.findUnique({ where: { id } });
  }

  async updateStep(stepId: string, tenantId: string, body: any) {
    const { count } = await this.prisma.browserMissionStep.updateMany({
      where: { id: stepId, mission: { tenantId } },
      data: {
        status: body.status,
        error: body.error,
        evidenceRef: body.evidenceRef
      }
    });
    if (count === 0) throw new NotFoundException("Mission step not found");
    return this.prisma.browserMissionStep.findUnique({ where: { id: stepId } });
  }
}
