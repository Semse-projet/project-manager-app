import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { SATELLITE_SCOPES_KEY } from "./satellite-scopes.decorator.js";
import { SatellitesService, type SatelliteIdentity } from "./satellites.service.js";

/**
 * Guard de doble identidad para satélites que actúan EN NOMBRE de un usuario
 * (SAT-003 — mobile app). A diferencia de SatelliteScopeGuard (donde el
 * satellite token ES la identidad completa de la request), este guard corre
 * junto al AuthGuard/RbacGuard normales: el usuario se autentica como siempre
 * (Authorization: Bearer <sesión de usuario>) y la app se identifica aparte
 * vía el header `x-semse-app-token`.
 *
 * Autorización efectiva = permisos del usuario (RbacGuard) ∩ scopes de la app
 * (este guard). Un app token robado sin sesión de usuario no lee nada, porque
 * el AuthGuard/RbacGuard normales igual exigen la sesión.
 *
 * No afecta ninguna ruta existente: solo aplica donde se declare
 * @UseGuards(SatelliteAppGuard) + @SatelliteScopes(...) explícitamente.
 */
@Injectable()
export class SatelliteAppGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly satellitesService: SatellitesService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const headers: Record<string, unknown> = request.headers ?? {};
    const appToken = headers["x-semse-app-token"];

    if (typeof appToken !== "string" || !appToken.trim()) {
      throw new UnauthorizedException({
        message: "Missing app token — expected header 'x-semse-app-token: sst_...'"
      });
    }

    const satellite: SatelliteIdentity = await this.satellitesService.verifyToken(appToken.trim());

    const required = this.reflector.getAllAndOverride<string[]>(SATELLITE_SCOPES_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    const missing = (required ?? []).filter((scope) => !satellite.scopes.includes(scope));
    if (missing.length > 0) {
      throw new ForbiddenException({
        message: "App token lacks required scopes",
        required,
        missing
      });
    }

    request.satelliteApp = satellite;
    return true;
  }
}
