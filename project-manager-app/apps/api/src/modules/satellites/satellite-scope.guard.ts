import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { SATELLITE_SCOPES_KEY } from "./satellite-scopes.decorator.js";
import { SatellitesService, type SatelliteIdentity } from "./satellites.service.js";

function extractBearerToken(headers: Record<string, unknown>): string | null {
  const authorization = headers.authorization;
  if (typeof authorization !== "string") {
    return null;
  }
  const [scheme, token] = authorization.trim().split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }
  return token;
}

/**
 * Guard para endpoints consumidos por satélites (SAT-001).
 * Se aplica con @UseGuards en endpoints @Public (fuera del auth de usuarios):
 * valida el satellite token, exige los scopes de @SatelliteScopes y adjunta
 * request.satellite para el handler.
 */
@Injectable()
export class SatelliteScopeGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly satellitesService: SatellitesService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = extractBearerToken(request.headers ?? {});
    if (!token) {
      throw new UnauthorizedException({
        message: "Missing satellite token — expected 'Authorization: Bearer sst_...'"
      });
    }

    const satellite: SatelliteIdentity = await this.satellitesService.verifyToken(token);

    const required = this.reflector.getAllAndOverride<string[]>(SATELLITE_SCOPES_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    const missing = (required ?? []).filter((scope) => !satellite.scopes.includes(scope));
    if (missing.length > 0) {
      throw new ForbiddenException({
        message: "Satellite token lacks required scopes",
        required,
        missing
      });
    }

    request.satellite = satellite;
    return true;
  }
}
