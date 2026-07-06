import { SetMetadata } from "@nestjs/common";

export const SATELLITE_SCOPES_KEY = "satellite_scopes";

/**
 * Scopes que un satellite token debe tener para acceder al endpoint.
 * Se usa junto con SatelliteScopeGuard (SAT-001). Sin scopes declarados,
 * el guard solo exige un token válido (introspección tipo /satellites/me).
 */
export function SatelliteScopes(...scopes: string[]): ReturnType<typeof SetMetadata> {
  return SetMetadata(SATELLITE_SCOPES_KEY, scopes);
}
