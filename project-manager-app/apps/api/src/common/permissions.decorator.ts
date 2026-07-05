import { SetMetadata } from "@nestjs/common";

export const REQUIRED_PERMISSIONS_KEY = "required_permissions";
export const AUTHENTICATED_ACCESS_KEY = "authenticated_access";

export function RequirePermissions(...permissions: string[]): ReturnType<typeof SetMetadata> {
  return SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);
}

export function AuthenticatedAccess(reason: string): ReturnType<typeof SetMetadata> {
  return SetMetadata(AUTHENTICATED_ACCESS_KEY, reason);
}
