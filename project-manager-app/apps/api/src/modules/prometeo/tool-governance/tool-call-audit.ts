import { createHash } from "node:crypto";
import { Logger } from "@nestjs/common";
import type { ToolGovernanceRepository } from "./tool-governance.repository.js";

/**
 * H05 — auditoría canónica por tool call (spec docs/specs/prometeo/tool-call-audit-lineage.spec.md).
 *
 * Modos (`PROMETEO_TOOL_AUDIT_LIFECYCLE`):
 *  - `off` (por defecto): comportamiento anterior; una fila terminal por llamada, sin las columnas nuevas.
 *  - `shadow`: registra inicio y estado terminal con lineage, redacción y retención; un fallo del propio audit se
 *    cuenta y se registra pero nunca cambia el resultado de la herramienta.
 *  - `enforce`: como `shadow`, pero una herramienta de ESCRITURA o CRÍTICA no se ejecuta si no se pudo persistir su
 *    registro de inicio (sin registro de inicio no hay efecto). Las lecturas siguen siendo fail-open (decisión D1).
 */

export type AuditLifecycleMode = "off" | "shadow" | "enforce";
export const REDACTION_VERSION = "1";
const DEFAULT_RETENTION_DAYS = 90;
const SUMMARY_LIMIT = 500;

export function resolveAuditLifecycleMode(env: NodeJS.ProcessEnv = process.env): AuditLifecycleMode {
  const raw = (env.PROMETEO_TOOL_AUDIT_LIFECYCLE ?? "off").trim().toLowerCase();
  return raw === "shadow" || raw === "enforce" ? raw : "off";
}

export function resolveRetentionDays(env: NodeJS.ProcessEnv = process.env): number {
  const parsed = Number.parseInt(env.PROMETEO_TOOL_AUDIT_RETENTION_DAYS ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_RETENTION_DAYS;
}

// ── Redacción ────────────────────────────────────────────────────────────────

const SENSITIVE_KEY =
  /pass(word|wd)?|secret|token|api[-_]?key|authorization|cookie|credential|private[-_]?key|cvv|cvc|iban|card(number)?|account(number|_number)?|routing|ssn|signature|otp|pin$/i;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const LONG_DIGITS = /\d[\d\s-]{7,}\d/g;
const MAX_DEPTH = 6;
const MAX_STRING = 200;
const MAX_ITEMS = 25;

function redactString(value: string): string {
  const masked = value.replace(EMAIL, "[email]").replace(LONG_DIGITS, "[digits]");
  return masked.length > MAX_STRING ? `${masked.slice(0, MAX_STRING)}…` : masked;
}

/** Copia redactada: claves sensibles ⇒ `[REDACTED]`, correos y secuencias largas de dígitos enmascarados, tamaño acotado. */
export function redactValue(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value ?? null;
  if (typeof value === "string") return redactString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (depth >= MAX_DEPTH) return "[truncated]";
  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ITEMS).map((item) => redactValue(item, depth + 1));
    if (value.length > MAX_ITEMS) items.push(`[+${value.length - MAX_ITEMS} más]`);
    return items;
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>).slice(0, MAX_ITEMS)) {
      out[key] = SENSITIVE_KEY.test(key) ? "[REDACTED]" : redactValue(item, depth + 1);
    }
    return out;
  }
  return "[unserializable]";
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
}

/**
 * Resumen y digest de una entrada/salida. El digest se calcula sobre la copia REDACTADA: un digest del valor original de
 * un secreto de baja entropía se podría romper por fuerza bruta, y el objetivo es comprobar integridad, no recuperar datos.
 */
export function summarizeForAudit(value: unknown): { summary: string; digest: string } | null {
  if (value === undefined) return null;
  const redacted = redactValue(value);
  const canonical = canonicalJson(redacted);
  const summary = canonical.length > SUMMARY_LIMIT ? `${canonical.slice(0, SUMMARY_LIMIT - 1)}…` : canonical;
  return { summary, digest: createHash("sha256").update(canonical).digest("hex") };
}

/** Versión estable de la policy evaluada: cambia si cambia el contrato del descriptor. */
export function policyVersionOf(descriptor: unknown): string {
  return `d1:${createHash("sha256").update(canonicalJson(descriptor)).digest("hex").slice(0, 12)}`;
}

// ── Ciclo de vida ────────────────────────────────────────────────────────────

export type AuditCtx = {
  executionId: string;
  tenantId: string;
  actorId: string;
  namespace: string;
  name: string;
  mode: string;
  requestId: string;
  source: "prometeo_tools" | "project_copilot" | "agent_runtime";
  policyVersion?: string;
  projectId?: string;
  runId?: string;
  sessionId?: string;
  threadId?: string;
  agentId?: string;
  approvalId?: string;
  proposedActionId?: string;
  input?: unknown;
};

export type AuditOutcome = {
  /** Vocabulario del audit: succeeded | blocked | queued | rejected | failed | timeout | cancelled | skipped. */
  status: string;
  blockedReason?: string;
  errorCode?: string;
  output?: unknown;
  /**
   * Fila a escribir con el ciclo de vida APAGADO (`off`), para conservar el comportamiento anterior: por defecto el mismo
   * estado, salvo `failed`/`timeout`/`cancelled` que antes no dejaban fila; `null` = no escribir nada.
   */
  legacy?: { status: string; blockedReason?: string } | null;
};

export const toolAuditMetrics = { startFailures: 0, terminalFailures: 0, writesRefused: 0 };

export class ToolAuditUnavailableError extends Error {
  constructor() {
    super("No se pudo registrar la auditoría de la herramienta; la herramienta de escritura no se ejecutó.");
    this.name = "ToolAuditUnavailableError";
  }
}

export function errorCodeOf(error: unknown): string {
  const name = (error as { name?: string } | null)?.name;
  if (name === "TimeoutError") return "TIMEOUT";
  if (name === "AbortError") return "CANCELLED";
  return "HANDLER_EXCEPTION";
}

export class ToolCallAuditor {
  private readonly logger = new Logger(ToolCallAuditor.name);

  constructor(
    private readonly repository: ToolGovernanceRepository | undefined,
    private readonly now: () => number = Date.now,
  ) {}

  private mode(): AuditLifecycleMode {
    return this.repository ? resolveAuditLifecycleMode() : "off";
  }

  private lifecycleFields(ctx: AuditCtx) {
    const input = summarizeForAudit(ctx.input);
    return {
      executionId: ctx.executionId,
      source: ctx.source,
      runId: ctx.runId,
      sessionId: ctx.sessionId,
      threadId: ctx.threadId,
      projectId: ctx.projectId,
      agentId: ctx.agentId,
      approvalId: ctx.approvalId,
      proposedActionId: ctx.proposedActionId,
      policyVersion: ctx.policyVersion,
      inputDigest: input?.digest,
      inputSummary: input?.summary,
      redactionVersion: REDACTION_VERSION,
    };
  }

  /**
   * Registra el INICIO antes de despachar el handler. Devuelve `true` si la fila de inicio existe. En `enforce`, una
   * escritura/crítica sin registro de inicio se rechaza (no hay efecto sin traza); lo demás nunca bloquea.
   */
  async begin(ctx: AuditCtx, opts: { critical: boolean }): Promise<boolean> {
    const mode = this.mode();
    if (mode === "off" || !this.repository) return false;
    try {
      await this.repository.recordStart({
        tenantId: ctx.tenantId,
        actorId: ctx.actorId,
        namespace: ctx.namespace,
        name: ctx.name,
        mode: ctx.mode,
        requestId: ctx.requestId,
        startedAt: new Date(this.now()),
        ...this.lifecycleFields(ctx),
      });
      return true;
    } catch (error) {
      toolAuditMetrics.startFailures += 1;
      this.logger.error(`tool-audit start failed ${ctx.namespace}.${ctx.name} exec=${ctx.executionId}: ${String(error)}`);
      if (mode === "enforce" && opts.critical) {
        toolAuditMetrics.writesRefused += 1;
        throw new ToolAuditUnavailableError();
      }
      return false;
    }
  }

  /**
   * Cierra la ejecución. Con `off` es la fila terminal anterior (sin columnas nuevas). Con el ciclo de vida activo
   * actualiza la fila de inicio; si no hubo inicio (denegaciones, fallo del inicio) escribe una fila terminal completa.
   * Un fallo aquí se cuenta y se registra pero NO deshace un efecto ya ocurrido.
   */
  async finish(ctx: AuditCtx, started: boolean, outcome: AuditOutcome, startedAtMs?: number): Promise<void> {
    if (!this.repository) return;
    const mode = this.mode();
    if (mode === "off") {
      const legacy =
        outcome.legacy !== undefined
          ? outcome.legacy
          : ["failed", "timeout", "cancelled"].includes(outcome.status)
            ? null
            : { status: outcome.status, blockedReason: outcome.blockedReason };
      if (legacy === null) return;
      await this.repository.recordInvocation({
        tenantId: ctx.tenantId,
        actorId: ctx.actorId,
        namespace: ctx.namespace,
        name: ctx.name,
        mode: ctx.mode,
        status: legacy.status,
        blockedReason: legacy.blockedReason,
        requestId: ctx.requestId,
      });
      return;
    }

    const completedAtMs = this.now();
    const startMs = startedAtMs ?? completedAtMs;
    const output = summarizeForAudit(outcome.output);
    const expiresAt = new Date(completedAtMs + resolveRetentionDays() * 86_400_000);
    const terminal = {
      status: outcome.status,
      blockedReason: outcome.blockedReason,
      errorCode: outcome.errorCode ?? (outcome.status === "blocked" ? "BLOCKED" : undefined),
      completedAt: new Date(completedAtMs),
      durationMs: Math.max(0, completedAtMs - startMs),
      outputDigest: output?.digest,
      outputSummary: output?.summary,
      expiresAt,
    };
    try {
      if (started) {
        await this.repository.recordTerminal(ctx.tenantId, ctx.executionId, terminal);
      } else {
        await this.repository.recordInvocation({
          tenantId: ctx.tenantId,
          actorId: ctx.actorId,
          namespace: ctx.namespace,
          name: ctx.name,
          mode: ctx.mode,
          status: outcome.status,
          blockedReason: outcome.blockedReason,
          requestId: ctx.requestId,
          startedAt: new Date(startMs),
          ...this.lifecycleFields(ctx),
          ...terminal,
        });
      }
    } catch (error) {
      toolAuditMetrics.terminalFailures += 1;
      this.logger.error(`tool-audit terminal failed ${ctx.namespace}.${ctx.name} exec=${ctx.executionId}: ${String(error)}`);
    }
  }
}
