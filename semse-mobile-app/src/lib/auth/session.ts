export type MobileSessionIdentity = {
  userId: string;
  tenantId: string;
  orgId: string;
  roles: string[];
};

export type MobileSessionState = {
  identity: MobileSessionIdentity | null;
  authenticated: boolean;
};

export const DEFAULT_MOBILE_SESSION: MobileSessionState = {
  identity: null,
  authenticated: false,
};
