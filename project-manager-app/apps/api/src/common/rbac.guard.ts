import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AUTHENTICATED_ACCESS_KEY, REQUIRED_PERMISSIONS_KEY } from "./permissions.decorator.js";
import { IS_PUBLIC_KEY } from "./public.decorator.js";
import { resolveRequestContext } from "./request-context.js";
import { hasPermission } from "./rbac.js";

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (isPublic) {
      return true;
    }

    const required = this.reflector.getAllAndOverride<string[]>(REQUIRED_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (!required?.length) {
      const explicitAuthenticatedAccess = this.reflector.getAllAndOverride<string>(AUTHENTICATED_ACCESS_KEY, [
        context.getHandler(),
        context.getClass()
      ]);

      if (explicitAuthenticatedAccess?.trim()) {
        return true;
      }

      throw new ForbiddenException({
        message: "RBAC metadata required",
        policy: "deny_by_default"
      });
    }

    const request = context.switchToHttp().getRequest();
    const actor = resolveRequestContext(request);
    const allowed = required.every((permission) => hasPermission(actor.roles, permission));

    if (!allowed) {
      throw new ForbiddenException({
        message: "Insufficient permissions",
        required,
        roles: actor.roles
      });
    }

    return true;
  }
}
