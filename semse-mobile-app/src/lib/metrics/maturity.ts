export type MaturityMetric = {
  key: string;
  label: string;
  target: number;
  current: number;
};

export const MOBILE_MATURITY_METRICS: readonly MaturityMetric[] = [
  { key: "screen_wiring", label: "pantallas cableadas", target: 1, current: 0 },
  { key: "domain_alignment", label: "alineacion de dominio", target: 1, current: 0 },
  { key: "agentic_traceability", label: "trazabilidad agentica", target: 1, current: 0 },
  { key: "organizational_memory", label: "memoria organizacional", target: 1, current: 0 },
  { key: "ops_observability", label: "observabilidad movil", target: 1, current: 0 },
] as const;
