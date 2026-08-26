// GET /v1/users (OPS_ADMIN, users:read) -- mirrors UsersRepository's
// UserRecord (apps/api/src/modules/users/users.repository.ts) exactly,
// no separate view mapper in the controller (same "no mapper" pattern as
// TimeEntryView/DisputeRecordView in their own schema files).
export type UserRecordView = {
  id: string;
  email: string;
  phone?: string;
  status: string;
  verificationStatus: string;
  trustScore: number;
  riskLevel: string;
  flags: string[];
  createdAt: string;
  updatedAt: string;
};
