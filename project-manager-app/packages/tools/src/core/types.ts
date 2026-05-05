// ─── Core Types — SEMSE Pro Tools v2 ─────────────────────────────────────────

export type TradeId =
  | "concrete"
  | "carpentry"
  | "electrical"
  | "plumbing"
  | "painting"
  | "drywall"
  | "flooring"
  | "tile"
  | "insulation"
  | "roofing"
  | "hvac"
  | "demolition"
  | "masonry"
  | "deck"
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

// ─── Derived Plans ───────────────────────────────────────────────────────────

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

export type EvidenceChecklist = {
  trade: TradeId;
  riskLevel: RiskLevel;
  requiredCount: number;
  items: EvidenceItem[];
  notes: string[];
};

export type MilestonePlan = {
  trade: TradeId;
  totalAmount: number;
  riskLevel: RiskLevel;
  milestones: Milestone[];
  fundingSchedule: number[];
};

export type EscrowPlan = {
  trade: TradeId;
  totalAmount: number;
  initialDeposit: number;
  holdback: number;
  releaseSchedule: number[];
  recommendedReserve: number;
  notes: string[];
};

export type ExportBundle = {
  toolId: string;
  trade: TradeId;
  mode: ToolMode;
  createdAt: string;
  quote: QuoteSummary;
  evidence: EvidenceChecklist;
  milestonePlan: MilestonePlan;
  escrowPlan: EscrowPlan;
  warnings: string[];
  recommendations: string[];
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
