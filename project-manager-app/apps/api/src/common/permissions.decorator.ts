import { SetMetadata } from "@nestjs/common";

export const REQUIRED_PERMISSIONS_KEY = "required_permissions";

export function RequirePermissions(...permissions: string[]): ReturnType<typeof SetMetadata> {
  return SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);
}
