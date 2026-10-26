/**
 * Roles efectivos de una sesión SEMSE: los que siguen ACTIVOS en Membership
 * (leídos de la base en cada llamada), que la sesión tenía al emitirse y, si se
 * pasan, que además declara el token. Una revocación en cualquiera de las
 * fuentes quita el rol. La vía web pasa los roles del JWT; la vía MCP (S1/D7)
 * no tiene JWT SEMSE y no pasa `tokenRoles`.
 */
export function intersectSessionRoles(
  activeRoles: readonly string[],
  sessionRoles: readonly string[],
  tokenRoles?: readonly string[],
): string[] {
  return activeRoles.filter(
    (role) => sessionRoles.includes(role) && (tokenRoles === undefined || tokenRoles.includes(role)),
  );
}
