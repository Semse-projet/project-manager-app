export type ToolMode = "client" | "professional" | "admin";
export type SupportedTool = "roofing" | "concrete" | "electrical" | "plumbing" | "hvac" | "painting" | "drywall" | "flooring" | "carpentry";

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
