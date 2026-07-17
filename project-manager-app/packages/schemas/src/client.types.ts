/**
 * @semse/schemas — client.types.ts
 *
 * Tipos TypeScript para el frontend (UI). Complementan los schemas Zod de validación API.
 * Migrado desde labsemse/src/types/index.ts con alineación al dominio canónico Job-first.
 */

// ─────────────────────────────────────────────────────────────
// USUARIOS Y ROLES
// ─────────────────────────────────────────────────────────────

export type UserRole = "client" | "professional" | "admin" | "worker";

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: UserRole;
  verified: boolean;
  createdAt: Date;
  phone?: string;
  location?: string;
  bio?: string;
  rating?: number;
  reviewCount?: number;
  completedJobs?: number;
  orgId?: string;
}

// ─────────────────────────────────────────────────────────────
// JOBS Y ESTADOS
// ─────────────────────────────────────────────────────────────

/** Estados visibles en UI (alineados al dominio canónico SEMSE) */
export type JobStatusUI =
  | "draft"
  | "posted"
  | "reserved"
  | "accepted"
  | "in_progress"
  | "review"
  | "dispute"
  | "completed"
  | "cancelled";

/** UI-facing budget type (superset of the API BudgetType Zod enum) */
export type JobBudgetTypeUI = "fixed" | "hourly" | "range" | "TIME_AND_MATERIALS";
export type LocationType = "on_site" | "remote" | "hybrid";
export type UrgencyLevel = "low" | "medium" | "high" | "urgent";

export interface JobBudget {
  min: number;
  max?: number;
  type: JobBudgetTypeUI;
}

export interface JobLocation {
  type: LocationType;
  address?: string;
  city?: string;
  country?: string;
}

export interface Job {
  id: string;
  title: string;
  description: string;
  scope?: string;
  category?: string;
  subcategory?: string;
  budget: JobBudget;
  location: JobLocation;
  urgency?: UrgencyLevel;
  status: JobStatusUI;
  clientId: string;
  clientOrgId?: string;
  professionalId?: string;
  professionalOrgId?: string;
  tenantId?: string;
  createdAt: Date;
  deadline?: Date;
  attachments: Attachment[];
  proposals: Proposal[];
  escrow?: Escrow;
  milestones?: Milestone[];
}

// ─────────────────────────────────────────────────────────────
// CATEGORÍAS DE SERVICIO
// ─────────────────────────────────────────────────────────────

export interface Subcategory {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  priceUnit: string;
}

export interface ServiceCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
  subcategories: Subcategory[];
  color: string;
}

// ─────────────────────────────────────────────────────────────
// PROPUESTAS
// ─────────────────────────────────────────────────────────────

export type ProposalStatus = "pending" | "accepted" | "rejected" | "withdrawn";

export interface Proposal {
  id: string;
  jobId: string;
  professionalId: string;
  professional?: User;
  message: string;
  price: number;
  estimatedDays: number;
  status: ProposalStatus;
  createdAt: Date;
}

export interface ProposalMilestone {
  id: string;
  title: string;
  description: string;
  amount: number;
  deliverables: string[];
  estimatedDays: number;
}

export interface ProposalQuestion {
  id: string;
  question: string;
  answer?: string;
  required: boolean;
}

export interface EnhancedProposal extends Proposal {
  milestones: ProposalMilestone[];
  attachments: Attachment[];
  isFeatured: boolean;
  coverLetter?: string;
  questions?: ProposalQuestion[];
  updatedAt: Date;
}

// ─────────────────────────────────────────────────────────────
// ESCROW Y MILESTONES
// ─────────────────────────────────────────────────────────────

export type EscrowStatus =
  | "pending"
  | "funded"
  | "held"
  | "partially_released"
  | "released"
  | "disputed"
  | "refunded";

export type MilestoneStatus =
  | "pending"
  | "submitted"
  | "awaiting_review"
  | "approved"
  | "rejected"
  | "paid";

export interface Milestone {
  id: string;
  title: string;
  description: string;
  amount: number;
  status: MilestoneStatus;
  dueDate?: Date;
  completedAt?: Date;
  jobId?: string;
  projectId?: string;
}

export interface Escrow {
  id: string;
  jobId: string;
  amount: number;
  status: EscrowStatus;
  milestones: Milestone[];
  createdAt: Date;
  releasedAt?: Date;
  fundedAt?: Date;
}

// ─────────────────────────────────────────────────────────────
// EVIDENCIA
// ─────────────────────────────────────────────────────────────

export type EvidenceType = "image" | "video" | "document";
export type EvidenceStatus = "pending" | "approved" | "rejected";

export interface ChecklistItem {
  id: string;
  label: string;
  completed: boolean;
  required: boolean;
}

export interface Evidence {
  id: string;
  jobId?: string;
  milestoneId?: string;
  projectId?: string;
  type: EvidenceType;
  url: string;
  thumbnail?: string;
  description: string;
  uploadedBy: string;
  uploadedAt: Date;
  status: EvidenceStatus;
  checklist: ChecklistItem[];
}

// ─────────────────────────────────────────────────────────────
// RESERVAS Y CONTRATOS
// ─────────────────────────────────────────────────────────────

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "no_show";

export interface Booking {
  id: string;
  professionalId: string;
  clientId: string;
  service: string;
  date: Date;
  startTime: string;
  endTime: string;
  status: BookingStatus;
  notes?: string;
  location?: string;
  price: number;
  createdAt: Date;
}

// ─────────────────────────────────────────────────────────────
// DISPUTAS
// ─────────────────────────────────────────────────────────────

export type DisputeStatusUI = "open" | "assigned" | "under_review" | "resolved" | "rejected";

export interface Dispute {
  id: string;
  jobId: string;
  raisedBy: string;
  reason: string;
  status: DisputeStatusUI;
  evidence?: Evidence[];
  resolution?: string;
  createdAt: Date;
  resolvedAt?: Date;
}

// ─────────────────────────────────────────────────────────────
// PROFESIONALES
// ─────────────────────────────────────────────────────────────

export interface Skill {
  id: string;
  name: string;
  category: string;
  level: "beginner" | "intermediate" | "advanced" | "expert";
  yearsOfExperience: number;
  endorsements: number;
  verified: boolean;
}

export interface SkillCategoryScore {
  category: string;
  score: number; // 0–100
  weight: number;
  skills: Skill[];
}

export interface SkillMatrix {
  technical: SkillCategoryScore[];
  soft: SkillCategoryScore[];
  tools: SkillCategoryScore[];
  languages: SkillCategoryScore[];
  overallScore: number;
}

export interface PortfolioItem {
  id: string;
  title: string;
  description: string;
  category: string;
  images: string[];
  link?: string;
  clientName?: string;
  completionDate: Date;
  skills: string[];
}

export interface Certification {
  id: string;
  name: string;
  issuer: string;
  issueDate: Date;
  expiryDate?: Date;
  credentialId?: string;
  verified: boolean;
}

export interface WorkExperience {
  id: string;
  company: string;
  position: string;
  location?: string;
  startDate: Date;
  endDate?: Date;
  current: boolean;
  description: string;
  skills: string[];
}

export interface Education {
  id: string;
  institution: string;
  degree: string;
  field: string;
  startDate: Date;
  endDate?: Date;
  current: boolean;
}

export interface Language {
  code: string;
  name: string;
  proficiency: "basic" | "conversational" | "fluent" | "native";
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  earnedAt: Date;
}

export interface ProfessionalTool {
  id: string;
  name: string;
  category: "design" | "development" | "communication" | "project_management" | "analytics" | "other";
  icon: string;
  proficiency: "beginner" | "intermediate" | "advanced" | "expert";
}

export interface AvailabilitySlot {
  id: string;
  professionalId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
}

export interface Professional extends User {
  role: "professional";
  skills: Skill[];
  skillMatrix: SkillMatrix;
  portfolio: PortfolioItem[];
  certifications: Certification[];
  experience: WorkExperience[];
  education: Education[];
  languages: Language[];
  availability: AvailabilitySlot[];
  hourlyRate: number;
  responseTime: number;
  onTimeDelivery: number;
  rehireRate: number;
  totalEarnings: number;
  activeProjects: number;
  isAvailable: boolean;
  memberSince: Date;
  lastActive: Date;
  badges: Badge[];
  tools: ProfessionalTool[];
}

export interface ProfessionalFilter {
  skills?: string[];
  categories?: string[];
  minRating?: number;
  maxHourlyRate?: number;
  availability?: "full_time" | "part_time" | "freelance";
  location?: string;
  languages?: string[];
  verifiedOnly?: boolean;
  minExperience?: number;
  tools?: string[];
}

export interface ProfessionalSearchResult {
  professional: Professional;
  matchScore: number;
  relevanceReasons: string[];
}

// ─────────────────────────────────────────────────────────────
// DASHBOARD Y MÉTRICAS
// ─────────────────────────────────────────────────────────────

export interface EarningsSummary {
  totalEarnings: number;
  thisMonth: number;
  lastMonth: number;
  pendingPayments: number;
  availableForWithdrawal: number;
  currency: string;
}

export interface DashboardProjectSummary {
  active: number;
  completed: number;
  cancelled: number;
  total: number;
}

export interface PerformanceMetrics {
  onTimeDelivery: number;
  clientSatisfaction: number;
  responseRate: number;
  rehireRate: number;
  averageRating: number;
}

export interface UpcomingDeadline {
  jobId: string;
  jobTitle: string;
  milestoneName: string;
  dueDate: Date;
  daysLeft: number;
}

export interface ActivityItem {
  id: string;
  type:
    | "proposal_sent"
    | "proposal_accepted"
    | "payment_received"
    | "review_received"
    | "message_received"
    | "job_completed"
    | "milestone_approved"
    | "dispute_opened";
  title: string;
  description: string;
  timestamp: Date;
  read: boolean;
  actionUrl?: string;
}

export interface ProfessionalDashboard {
  earnings: EarningsSummary;
  projects: DashboardProjectSummary;
  performance: PerformanceMetrics;
  upcomingDeadlines: UpcomingDeadline[];
  recentActivity: ActivityItem[];
}

// ─────────────────────────────────────────────────────────────
// NOTIFICACIONES Y MENSAJERÍA
// ─────────────────────────────────────────────────────────────

export type NotificationType = "info" | "success" | "warning" | "error";

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  actionUrl?: string;
  createdAt: Date;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  attachments?: Attachment[];
  createdAt: Date;
  read: boolean;
}

// ─────────────────────────────────────────────────────────────
// REVIEWS Y REPUTACIÓN
// ─────────────────────────────────────────────────────────────

export interface Review {
  id: string;
  jobId: string;
  reviewerId: string;
  revieweeId: string;
  rating: number;
  comment: string;
  createdAt: Date;
}

export interface Testimonial {
  id: string;
  name: string;
  role: string;
  avatar: string;
  content: string;
  rating: number;
  company?: string;
}

// ─────────────────────────────────────────────────────────────
// PRICING PLANS
// ─────────────────────────────────────────────────────────────

export interface PricingPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  period: "monthly" | "yearly";
  features: string[];
  highlighted?: boolean;
  cta: string;
}

// ─────────────────────────────────────────────────────────────
// ATTACHMENTS
// ─────────────────────────────────────────────────────────────

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  uploadedAt: Date;
}

// ─────────────────────────────────────────────────────────────
// FIELD OPS (de semse-control-mvp)
// ─────────────────────────────────────────────────────────────

export type UnitStatus = "IN_PROGRESS" | "COMPLETED" | "BLOCKED" | "PENDING";

export interface Unit {
  id: string;
  code: string;
  name?: string;
  address?: string;
  status: UnitStatus;
  teamId: string;
  createdAt: Date;
}

export interface WorklogEntry {
  id: string;
  unitId: string;
  date: Date;
  doneToday: string;
  pendingNext: string;
  blockers?: string;
  notes?: string;
  createdBy: string;
  createdAt: Date;
}

export interface KnowledgeFact {
  id: string;
  teamId: string;
  unitId?: string;
  content: string;
  source: string;
  createdBy: string;
  createdAt: Date;
}
