import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { REQUIRED_PERMISSIONS_KEY } from "./permissions.decorator.js";
import { resolveRequestContext } from "./request-context.js";
import { hasPermission } from "./rbac.js";

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(REQUIRED_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (!required?.length) {
      return true;
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
