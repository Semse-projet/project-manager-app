export type AiMissionStatsLike = {
  total: number;
  success: number;
  failureRate: number;
  byMode: Record<string, number>;
};

export type AiMissionLogLike = {
  createdAt: string;
  mode: string;
  success: boolean;
  fallbackUsed: boolean;
};

export type AiMissionReadinessLike = {
  llmOrchestrator: {
    hasProvider: boolean;
    providers: string[];
  };
  environment: {
    anthropicConfigured: boolean;
    openaiConfigured: boolean;
    deepseekConfigured: boolean;
    kimiConfigured: boolean;
    openSourceEnabled: boolean;
  };
  models: Array<{
    slug: string;
    provider: string;
    enabled: boolean;
  }>;
  routeSamples: Array<{
    taskType: string;
    route: {
      primaryModelSlug: string;
      fallbackModelSlug?: string;
    };
  }>;
};

export type AiMissionContextLike = {
  mode: string;
  systemHealth?: {
    api: string;
    worker: string;
    redis: string;
  };
};

export type AiMissionLiveHealthLike = {
  api: string;
  worker: string;
  redis: string;
};

export type AiMissionAlertSeverity = "critical" | "high" | "medium" | "info";

export type AiMissionAlert = {
  id: string;
  severity: AiMissionAlertSeverity;
  title: string;
  detail: string;
};

export type AiMissionDiagnostics = {
  posture: "stable" | "watch" | "degraded" | "critical";
  alerts: AiMissionAlert[];
  counters: {
    configuredProviders: number;
    runtimeProviders: number;
    enabledRealModels: number;
    fallbackCount: number;
    contextOnlyCount: number;
    staleMinutes: number | null;
    successRate: number;
  };
};

export type AiMissionSignalSource = "bootstrap" | "manual" | "poll" | "health-stream" | "context-stream";

export type AiMissionIncident = {
  id: string;
  source: AiMissionSignalSource;
  createdAt: string;
  posture: AiMissionDiagnostics["posture"];
  severity: AiMissionAlertSeverity;
  title: string;
  detail: string;
  alertIds: string[];
};

const SEVERITY_RANK: Record<AiMissionAlertSeverity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  info: 1,
};

const POSTURE_RANK: Record<AiMissionDiagnostics["posture"], number> = {
  stable: 1,
  watch: 2,
  degraded: 3,
  critical: 4,
};

function newestLogAgeMinutes(logs: AiMissionLogLike[]): number | null {
  if (logs.length === 0) return null;
  const newest = logs
    .map((log) => Date.parse(log.createdAt))
    .filter((ts) => Number.isFinite(ts))
    .sort((a, b) => b - a)[0];
  if (!Number.isFinite(newest)) return null;
  return Math.max(0, Math.round((Date.now() - newest) / 60_000));
}

function pushAlert(
  alerts: AiMissionAlert[],
  id: string,
  severity: AiMissionAlertSeverity,
  title: string,
  detail: string,
) {
  alerts.push({ id, severity, title, detail });
}

export function buildAiMissionDiagnostics(input: {
  stats: AiMissionStatsLike | null;
  logs: AiMissionLogLike[];
  readiness: AiMissionReadinessLike | null;
  context: AiMissionContextLike | null;
  liveHealth: AiMissionLiveHealthLike | null;
}): AiMissionDiagnostics {
  const alerts: AiMissionAlert[] = [];

  const readiness = input.readiness;
  const stats = input.stats;
  const logs = input.logs;
  const liveHealth = input.liveHealth ?? input.context?.systemHealth ?? null;

  const configuredProviders = readiness
    ? [
      readiness.environment.anthropicConfigured,
      readiness.environment.openaiConfigured,
      readiness.environment.deepseekConfigured,
      readiness.environment.kimiConfigured,
      readiness.environment.openSourceEnabled,
    ].filter(Boolean).length
    : 0;

  const runtimeProviders = readiness
    ? readiness.llmOrchestrator.providers.filter((provider) => provider !== "template").length
    : 0;

  const enabledRealModels = readiness
    ? readiness.models.filter((model) => model.enabled && model.provider !== "template").length
    : 0;

  const fallbackCount = logs.filter((log) => log.fallbackUsed || log.mode === "fallback").length;
  const contextOnlyCount = logs.filter((log) => log.mode === "context_only").length;
  const successRate = stats && stats.total > 0 ? stats.success / stats.total : 0;
  const staleMinutes = newestLogAgeMinutes(logs);

  if (!readiness) {
    pushAlert(alerts, "readiness-missing", "medium", "Readiness no disponible", "El gateway no entrego diagnostico de modelos ni providers.");
  } else {
    if (!readiness.llmOrchestrator.hasProvider || runtimeProviders === 0) {
      pushAlert(alerts, "runtime-provider-missing", "critical", "Gateway sin provider real", "No hay provider runtime disponible fuera del template.");
    }

    if (configuredProviders === 0) {
      pushAlert(alerts, "provider-config-missing", "critical", "Sin providers configurados", "No hay llaves ni runtime open source habilitado.");
    } else if (enabledRealModels <= 1) {
      pushAlert(alerts, "single-model-posture", "info", "Postura de modelo unico", "Solo hay un modelo real habilitado; el fallback operativo es fragil.");
    }

    const riskyTasksWithoutFallback = readiness.routeSamples.filter((sample) =>
      ["risk_analysis", "construction_contract_analysis", "architecture_review"].includes(sample.taskType)
      && !sample.route.fallbackModelSlug,
    );
    if (riskyTasksWithoutFallback.length > 0) {
      pushAlert(
        alerts,
        "fallback-gap",
        "medium",
        "Rutas premium sin fallback",
        `Faltan fallbacks para ${riskyTasksWithoutFallback.map((sample) => sample.taskType).join(", ")}.`,
      );
    }
  }

  if (stats && stats.total >= 5) {
    if (successRate < 0.6) {
      pushAlert(alerts, "success-rate-critical", "high", "Success rate bajo", `Solo ${Math.round(successRate * 100)}% de llamadas exitosas.`);
    } else if (successRate < 0.8) {
      pushAlert(alerts, "success-rate-watch", "medium", "Success rate inestable", `El exito cayo a ${Math.round(successRate * 100)}%.`);
    }
  }

  if (logs.length >= 5) {
    const fallbackRate = fallbackCount / logs.length;
    const contextOnlyRate = contextOnlyCount / logs.length;

    if (fallbackRate >= 0.25) {
      pushAlert(alerts, "fallback-rate-high", "high", "Mucho fallback", `${fallbackCount}/${logs.length} respuestas usaron fallback.`);
    } else if (fallbackRate >= 0.1) {
      pushAlert(alerts, "fallback-rate-watch", "medium", "Fallback creciente", `${fallbackCount}/${logs.length} respuestas dependen de fallback.`);
    }

    if (contextOnlyRate >= 0.6) {
      pushAlert(alerts, "context-only-dominant", "medium", "Predomina context_only", `${contextOnlyCount}/${logs.length} respuestas no pasaron por modelo runtime.`);
    }
  }

  if (staleMinutes !== null && staleMinutes > 30 && runtimeProviders > 0) {
    pushAlert(alerts, "logs-stale", "info", "Actividad AI estancada", `No hay llamadas nuevas desde hace ${staleMinutes} min.`);
  }

  if (input.context?.mode === "demo") {
    pushAlert(alerts, "demo-mode", "medium", "Contexto en demo", "Mission Control esta leyendo un contexto simulado y no el runtime real.");
  }

  if (liveHealth) {
    for (const key of ["api", "worker", "redis"] as const) {
      if (liveHealth[key] !== "ok") {
        pushAlert(
          alerts,
          `health-${key}`,
          key === "api" ? "critical" : "high",
          `${key.toUpperCase()} degradado`,
          `El componente ${key.toUpperCase()} reporta estado ${liveHealth[key]}.`,
        );
      }
    }
  }

  alerts.sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);
  const maxSeverity = alerts[0]?.severity;
  const posture = maxSeverity === "critical"
    ? "critical"
    : maxSeverity === "high"
      ? "degraded"
      : maxSeverity === "medium"
        ? "watch"
        : "stable";

  return {
    posture,
    alerts,
    counters: {
      configuredProviders,
      runtimeProviders,
      enabledRealModels,
      fallbackCount,
      contextOnlyCount,
      staleMinutes,
      successRate,
    },
  };
}

function severityFromPosture(posture: AiMissionDiagnostics["posture"]): AiMissionAlertSeverity {
  if (posture === "critical") return "critical";
  if (posture === "degraded") return "high";
  if (posture === "watch") return "medium";
  return "info";
}

export function buildAiMissionIncident(input: {
  previous: AiMissionDiagnostics | null;
  current: AiMissionDiagnostics;
  source: AiMissionSignalSource;
  now?: string;
}): AiMissionIncident | null {
  const { previous, current, source } = input;
  const previousAlertIds = new Set(previous?.alerts.map((alert) => alert.id) ?? []);
  const escalatedAlerts = current.alerts.filter((alert) =>
    (alert.severity === "critical" || alert.severity === "high") && !previousAlertIds.has(alert.id),
  );

  const postureWorsened = !previous || POSTURE_RANK[current.posture] > POSTURE_RANK[previous.posture];
  if (!postureWorsened && escalatedAlerts.length === 0) {
    return null;
  }

  const severity = escalatedAlerts[0]?.severity ?? severityFromPosture(current.posture);
  const alertIds = escalatedAlerts.map((alert) => alert.id);
  const createdAt = input.now ?? new Date().toISOString();

  if (escalatedAlerts.length > 0) {
    return {
      id: `${source}:${createdAt}:alerts`,
      source,
      createdAt,
      posture: current.posture,
      severity,
      title: `${escalatedAlerts.length} alerta(s) nuevas de alto impacto`,
      detail: escalatedAlerts.map((alert) => alert.title).join(" · "),
      alertIds,
    };
  }

  const previousLabel = previous ? previous.posture.toUpperCase() : "BOOT";
  return {
    id: `${source}:${createdAt}:posture`,
    source,
    createdAt,
    posture: current.posture,
    severity,
    title: `Postura ${current.posture.toUpperCase()}`,
    detail: `Mission Control paso de ${previousLabel} a ${current.posture.toUpperCase()}.`,
    alertIds: current.alerts.map((alert) => alert.id),
  };
}
