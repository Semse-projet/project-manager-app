export type ToolMode = "client" | "professional" | "admin";
export type SupportedTool = "roofing" | "concrete" | "electrical" | "plumbing" | "hvac" | "painting" | "drywall" | "flooring" | "carpentry" | "tile" | "windowsDoors" | "windows-doors" | "windowDoors" | "insulation" | "demolition" | "masonry" | "deck" | "fencing" | "landscaping" | "project-manager" | "labor" | "solar";

export type ValidationIssue = {
  field: string;
  severity: "error" | "warning" | "info";
  message: string;
  suggestion?: string;
};

export type MaterialItem = {
  name: string;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
  category: string;
  notes?: string;
};

export type LaborEstimate = {
  hours: number;
  crewSize: number;
  days: number;
  ratePerHour: number;
  totalCost: number;
  difficulty: "simple" | "moderate" | "complex" | "specialist";
  notes: string[];
};

export type CostSummary = {
  materials: number;
  labor: number;
  overhead: number;
  profit: number;
  semseFee: number;
  taxes: number;
  total: number;
  perUnit?: number;
  currency: "USD";
};

export type RiskFactor = {
  id: string;
  label: string;
  weight: number;
  triggered: boolean;
  reason?: string;
};

export type RiskLevel = "low" | "medium" | "high" | "critical";

export type RiskResult = {
  level: RiskLevel;
  score: number;
  factors: RiskFactor[];
  requiresPermit: boolean;
  requiresLicense: boolean;
  requiresInspection: boolean;
  requiresEngineering: boolean;
};

export type Milestone = {
  sequence: number;
  title: string;
  description: string;
  percentage: number;
  amount: number;
  evidenceRequired: string[];
  releaseTrigger: string;
};

export type EvidenceItem = {
  type: "photo" | "video" | "document" | "measurement" | "inspection";
  description: string;
  required: boolean;
  milestone?: number;
};

export type SemseToolResult = {
  toolId: string;
  trade: string;
  projectType: string;
  mode: ToolMode;
  inputs: Record<string, unknown>;
  validationIssues: ValidationIssue[];
  isValid: boolean;
  materials: MaterialItem[];
  labor: LaborEstimate;
  costs: CostSummary;
  risk: RiskResult;
  milestones: Milestone[];
  evidenceRequired: EvidenceItem[];
  warnings: string[];
  recommendations: string[];
  assumptions: string[];
  createdAt: string;
};

export type ToolCalculateRequest = {
  tool: SupportedTool;
  mode?: ToolMode;
  input: Record<string, unknown>;
};

export type QuoteSummary = {
  materials: number;
  labor: number;
  overhead: number;
  profit: number;
  semseFee: number;
  contingency: number;
  taxes: number;
  subtotal: number;
  total: number;
  recommendedDeposit: number;
  recommendedEscrow: number;
  currency: "USD";
  notes: string[];
};

export type EscrowPlan = {
  trade: string;
  totalAmount: number;
  initialDeposit: number;
  holdback: number;
  releaseSchedule: number[];
  recommendedReserve: number;
  notes: string[];
};

export type MilestonePlan = {
  trade: string;
  totalAmount: number;
  riskLevel: RiskLevel;
  milestones: Milestone[];
  fundingSchedule: number[];
};

export type ChangeOrderImpact = {
  trade: string;
  deltaPercent: number;
  deltaAmount: number;
  recommendedDepositAdjustment: number;
  notes: string[];
};

export type DisputeRiskSnapshot = {
  trade: string;
  score: number;
  level: RiskLevel;
  factors: string[];
};

async function postToolEndpoint<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as { data?: T; error?: { message?: string } };
  if (!response.ok) throw new Error(payload.error?.message ?? `Error calling ${path}`);
  if (!payload.data) throw new Error(`No data returned from ${path}`);
  return payload.data;
}

export async function fetchToolQuote(result: SemseToolResult): Promise<QuoteSummary> {
  return postToolEndpoint<QuoteSummary>("/api/semse/tools/quote", { result });
}

export async function fetchToolMilestonePlan(result: SemseToolResult): Promise<MilestonePlan> {
  return postToolEndpoint<MilestonePlan>("/api/semse/tools/milestones", { result });
}

export async function fetchToolEscrowPlan(result: SemseToolResult): Promise<EscrowPlan> {
  return postToolEndpoint<EscrowPlan>("/api/semse/tools/escrow", { result });
}

export async function fetchToolChangeOrder(result: SemseToolResult, deltaPercent: number): Promise<ChangeOrderImpact> {
  return postToolEndpoint<ChangeOrderImpact>("/api/semse/tools/change-order", { result, deltaPercent });
}

export async function fetchToolDisputeRisk(result: SemseToolResult): Promise<DisputeRiskSnapshot> {
  return postToolEndpoint<DisputeRiskSnapshot>("/api/semse/tools/dispute-risk", { result });
}

export async function calculateSemseTool(input: ToolCalculateRequest): Promise<SemseToolResult> {
  const response = await fetch("/api/semse/tools/calculate", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const payload = (await response.json()) as {
    data?: SemseToolResult;
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(payload.error?.message ?? "No se pudo calcular la herramienta.");
  }

  if (!payload.data) {
    throw new Error("La API no devolvió un resultado válido.");
  }

  return payload.data;
}
