// ─── Core Types — SEMSE Pro Tools v2 ─────────────────────────────────────────

export type TradeId =
  | "concrete"
  | "carpentry"
  | "electrical"
  | "plumbing"
  | "painting"
  | "drywall"
  | "flooring"
  | "roofing"
  | "hvac"
  | "inspection";

export type RiskLevel = "low" | "medium" | "high" | "critical";
export type ToolMode = "client" | "professional" | "admin";
export type UnitSystem = "imperial" | "metric";

// ─── Validation ───────────────────────────────────────────────────────────────

export type ValidationSeverity = "error" | "warning" | "info";

export type ValidationIssue = {
  field: string;
  severity: ValidationSeverity;
  message: string;
  suggestion?: string;
};

// ─── Materials ────────────────────────────────────────────────────────────────

export type MaterialItem = {
  name: string;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
  category: string;
  notes?: string;
};

// ─── Labor ────────────────────────────────────────────────────────────────────

export type LaborEstimate = {
  hours: number;
  crewSize: number;
  days: number;
  ratePerHour: number;
  totalCost: number;
  difficulty: "simple" | "moderate" | "complex" | "specialist";
  notes: string[];
};

// ─── Costs ────────────────────────────────────────────────────────────────────

export type CostSummary = {
  materials: number;
  labor: number;
  overhead: number;       // % applied
  profit: number;         // % applied
  semseFee: number;       // platform fee
  taxes: number;
  total: number;
  perUnit?: number;
  currency: "USD";
};

// ─── Risk ─────────────────────────────────────────────────────────────────────

export type RiskFactor = {
  id: string;
  label: string;
  weight: number;         // 0–1
  triggered: boolean;
  reason?: string;
};

export type RiskResult = {
  level: RiskLevel;
  score: number;          // 0–100
  factors: RiskFactor[];
  requiresPermit: boolean;
  requiresLicense: boolean;
  requiresInspection: boolean;
  requiresEngineering: boolean;
};

// ─── Milestones ───────────────────────────────────────────────────────────────

export type Milestone = {
  sequence: number;
  title: string;
  description: string;
  percentage: number;     // % of total
  amount: number;
  evidenceRequired: string[];
  releaseTrigger: string;
};

// ─── Evidence ────────────────────────────────────────────────────────────────

export type EvidenceItem = {
  type: "photo" | "video" | "document" | "measurement" | "inspection";
  description: string;
  required: boolean;
  milestone?: number;
};

// ─── Main Result ──────────────────────────────────────────────────────────────

export type SemseToolResult = {
  toolId: string;
  trade: TradeId;
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
