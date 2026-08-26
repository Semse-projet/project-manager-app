/**
 * Shared navigation param-list types.
 *
 * Role keys mirror packages/db/prisma/seed.ts's ROLE_PERMISSIONS: CLIENT, PRO,
 * WORKER, OPS_ADMIN. PRO = independent professional/contractor; WORKER = an
 * employee working under a company/contractor. Both are field-labor personas
 * that need the tracker/evidence/field UI, so both map to the worker tab
 * navigator (see RoleGate.tsx) — the RBAC seed data's WORKER permission set
 * (agents:run:worker/manage) is narrower than PRO's today, which may need
 * broadening as more of the worker tab surface gets built in later phases.
 */

import type { NavigatorScreenParams } from "@react-navigation/native";

export type RootStackParamList = {
  Login: undefined;
  ForgotPassword: undefined;
  /** Mounts RoleGate, which internally picks Worker/Client/Admin tabs based on the authenticated user's roles. */
  Authenticated: undefined;
};

export type WorkerTabParamList = {
  Timer: undefined;
  /**
   * Mounts WorkerJobsStackNavigator — jobs list, job detail, and per-job
   * evidence live under this one tab. Typed as NavigatorScreenParams so
   * sibling tabs (e.g. Bids) can deep-link into a specific nested screen via
   * navigation.navigate("Jobs", { screen: "JobDetail", params: { jobId } }).
   */
  Jobs: NavigatorScreenParams<WorkerJobsStackParamList> | undefined;
  Bids: undefined;
  /** Mounts WorkerMoreStackNavigator — everything used less than daily (Proyectos libres, Disputas, Incidentes, Viajes, Ajustes) lives behind this one tab so the bottom bar stays at 4 items. */
  More: NavigatorScreenParams<WorkerMoreStackParamList> | undefined;
};

export type WorkerJobsStackParamList = {
  JobsList: undefined;
  JobDetail: { jobId: string };
  Evidence: { jobId: string; jobTitle?: string };
};

export type WorkerMoreStackParamList = {
  MoreMenu: undefined;
  FreeProjects: undefined;
  Disputes: undefined;
  DisputeDetail: { disputeId: string };
  Incidents: undefined;
  Travel: undefined;
  TravelDetail: { travelId: string };
  Materials: undefined;
  Rates: undefined;
  Agenda: undefined;
  Review: undefined;
  ReviewForm: { jobId: string; jobTitle: string; toUserId: string; toUserEmail?: string };
  Payments: undefined;
  Settings: undefined;
};

export type ClientTabParamList = {
  /** Mounts ClientJobsStackNavigator — jobs list, job detail, and rating live under this one tab. Same NavigatorScreenParams pattern as WorkerTabParamList.Jobs. */
  Jobs: NavigatorScreenParams<ClientJobsStackParamList> | undefined;
  Settings: undefined;
};

export type ClientJobsStackParamList = {
  JobsList: undefined;
  JobDetail: { jobId: string };
  Rating: { jobId: string; jobTitle: string; toUserId: string; toUserEmail: string };
};

export type AdminTabParamList = {
  Dashboard: undefined;
  /** Mounts AdminDisputesStackNavigator — read-only list + detail, see mobile-admin-disputes.spec.md. */
  Disputes: NavigatorScreenParams<AdminDisputesStackParamList> | undefined;
  /** QualityGuard alerts + team weekly summary, read-only, see mobile-admin-labor-overview.spec.md. */
  Labor: undefined;
  /** Tenant-wide user directory, read-only, see mobile-admin-users.spec.md. */
  Users: undefined;
  /** List + stats + create, org-scoped — see mobile-admin-contractors.spec.md. No status change/delete/estimate actions. */
  Contractors: undefined;
  Settings: undefined;
};

export type AdminDisputesStackParamList = {
  DisputesList: undefined;
  DisputeDetail: { disputeId: string };
};
