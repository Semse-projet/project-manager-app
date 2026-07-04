/**
 * @semse/agents — verifiers.ts
 *
 * SPEC-AGT-001 (bloque AGT-001-B): registry de verificadores del
 * Verification Loop. Regla ADR-021 §6: los verificadores son los mismos
 * comandos de CI (spawnSync, mismo patrón que packages/autonomy/validator) —
 * nunca lógica ad-hoc del agente.
 *
 * Los tests (y cualquier runtime embebido sin acceso a shell) inyectan
 * implementaciones con `registerVerifierImpl`, igual que `setDelegateImpl`
 * en runtime.ts.
 */
import { spawnSync } from "node:child_process";
import {
  EVIDENCE_MAX_BYTES,
  type VerificationAttempt,
  type VerificationAttemptStatus,
  type VerifierName,
  verifierNames
} from "./verification.js";
import { setVerifierRunner } from "./runtime.js";

export type VerifierContext = {
  /** Raíz del repo/workspace sobre el que corre el comando. */
  repoPath: string;
  /** Workspace pnpm afectado (p.ej. "@semse/agents"); opcional. */
  workspace?: string;
  /** Datos libres que el handler puede pasar a verify.custom. */
  payload?: Record<string, unknown>;
};

export type VerifierOutcome = {
  status: VerificationAttemptStatus;
  evidence?: string;
};

export type VerifierImpl = (ctx: VerifierContext) => VerifierOutcome;

/** Comando CI por verificador. `{workspace}` se sustituye si hay workspace. */
const DEFAULT_VERIFIER_COMMANDS: Record<Exclude<VerifierName, "verify.custom">, string[]> = {
  "verify.typecheck": ["pnpm", "run", "typecheck"],
  "verify.lint": ["pnpm", "run", "lint"],
  "verify.unit_tests": ["pnpm", "run", "test:unit"],
  "verify.build": ["pnpm", "run", "build:packages"],
  "verify.schema": ["pnpm", "--filter", "@semse/schemas", "build"]
};

function truncateEvidence(value: string): string {
  return value.length > EVIDENCE_MAX_BYTES ? value.slice(0, EVIDENCE_MAX_BYTES) : value;
}

function spawnVerifier(command: string[], ctx: VerifierContext): VerifierOutcome {
  const [bin, ...args] = command;
  const result = spawnSync(bin, args, {
    cwd: ctx.repoPath,
    encoding: "utf8",
    env: { ...process.env, LANG: "C", LC_ALL: "C" }
  });

  if (result.error) {
    return { status: "error", evidence: truncateEvidence(result.error.message) };
  }

  if (result.status === 0) {
    return { status: "pass" };
  }

  return {
    status: "fail",
    evidence: truncateEvidence(`${result.stderr || ""}\n${result.stdout || ""}`.trim())
  };
}

const customImpls = new Map<VerifierName, VerifierImpl>();

/** Inyecta (o reemplaza) la implementación de un verificador. */
export function registerVerifierImpl(name: VerifierName, impl: VerifierImpl): void {
  customImpls.set(name, impl);
}

/** Limpia todas las implementaciones inyectadas (tests). */
export function resetVerifierImpls(): void {
  customImpls.clear();
}

export function hasVerifierImpl(name: VerifierName): boolean {
  return customImpls.has(name);
}

/**
 * Ejecuta un verificador y devuelve el intento con duración y evidencia.
 * `verify.custom` sin impl inyectada se reporta como "skipped" — nunca
 * cuenta como pass silencioso (mitigación de falsa confianza, ADR §6).
 */
export function runVerifier(name: VerifierName, iteration: number, ctx: VerifierContext): VerificationAttempt {
  const start = Date.now();

  let outcome: VerifierOutcome;
  const injected = customImpls.get(name);

  if (injected) {
    try {
      outcome = injected(ctx);
    } catch (error) {
      outcome = {
        status: "error",
        evidence: truncateEvidence(error instanceof Error ? error.message : String(error))
      };
    }
  } else if (name === "verify.custom") {
    outcome = { status: "skipped", evidence: "verify.custom has no registered implementation" };
  } else {
    outcome = spawnVerifier(DEFAULT_VERIFIER_COMMANDS[name], ctx);
  }

  return {
    iteration,
    verifier: name,
    status: outcome.status,
    durationMs: Date.now() - start,
    ...(outcome.evidence ? { evidence: truncateEvidence(outcome.evidence) } : {})
  };
}

/** Ejecuta los successCriteria en orden. Devuelve todos los intentos de la iteración. */
export function runVerifiers(criteria: VerifierName[], iteration: number, ctx: VerifierContext): VerificationAttempt[] {
  return criteria.map((name) => runVerifier(name, iteration, ctx));
}

export function isKnownVerifier(name: string): name is VerifierName {
  return (verifierNames as readonly string[]).includes(name);
}

// Auto-instalación: cargar este módulo (entrypoint server-side) conecta el
// verification loop del runtime con los verificadores spawnSync reales.
setVerifierRunner(runVerifiers);
