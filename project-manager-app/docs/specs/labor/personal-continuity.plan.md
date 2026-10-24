---
type: plan
feature: "personal-continuity"
domain: "labor"
spec: "docs/specs/labor/personal-continuity.spec.md"
version: "2.0"
status: "DRAFT"
branch: "docs/personal-continuity-f1b-20261024"
date: "2026-10-24"
---

# Plan F1B — Acceso personal separado y custodia duradera

> **DRAFT / no implementar.** El programa F0 (#1035) y la exportación F1A (#1036) todavía están en PRs separados. Este plan no autoriza cambiar `AuthService`, `AuthSession`, `TimeEntry`, tablas, migraciones o retención en producción.

## 1. Base comprobada estáticamente en main (2026-10-24)

- `User` global, `Membership` por `Org`; login con `memberships[0]` exige alguna ACTIVE.
- `AuthRepository.createUserWithOrg` crea identidad y organización con Membership en tenant predeterminado. La persona puede iniciar registro sin su patrón.
- `AuthSession` exige `userId/tenantId/orgId`, `AuthService.authorizedRoles` cruza sesión y roles efectivos de esa Org.
- `TimeEntry` exige `tenantId/orgId/createdBy`; `FreeProject` exige `tenantId/createdBy`; no forman archivo portable independiente.
- `Tenant` enlaza `TimeEntry` y `FreeProject` con `onDelete: Cascade`; no se ha probado flujo de borrado productivo.
- `ADR-040` contiene reconciliación que **rechaza** un cambio de Org en la sesión como fuente de autoridad.
- `Business Access Foundation` advierte contra sesiones no revocables y privilegios por claims. No degradar los controles existentes.
- Producción, migraciones reales, Railway, flags y latencias actuales: **NOT_VERIFIED**. Antes de código obtener SHAs actualizados.

## 2. Constitución y dependencia de decisiones

- [ ] Aprobación ADR-WPI-002 (`Proposed`) por owner, Identity/Auth, Security, Privacy/Legal.
- [ ] Aprobación de F1B `labor.personal-continuity.spec.md`; desglosar en pequeñas slices, no un cambio global de login.
- [ ] Determinar reglas concretas por `recordClass` y derecho de conservación.
- [ ] Auditar `AuthGuard`, BFF, mobile auth, Refresh/Logout, Worker, SSE, WebSocket, Prometeo y `@RequirePermissions` antes de agregar tipo de principal.
- [ ] Resolver retención y cascadas sin alterar derechos de empresa o usuario.
- [ ] Tests negativos diseñados antes de implementación; CI al final.

## 3. Dependencias y arquitectura

### F1B-A — Prueba de separación de autoridad PERSONAL/ORG (primero)

- Principal discriminado propuesto, no implementado:
  `{ kind: "PERSONAL", userId, sessionId, authStrength }` versus
  `{ kind: "ORG", userId, tenantId, orgId, sessionId, effectiveRoles }`.
- Decidir quién firma/almacena la sesión personal y cómo se revalida, expira y revoca. **No reusar firma de sesión empresarial ni inferir Org por preferencia UI**.
- Personal sólo puede acceder a `/me/personal-*` autorizadas. Guards corporativos deben rechazar principal personal aunque `User.id` tenga roles de otra Org.
- Preservar login y refresh de cuentas actuales; personas sin Membership deben poder autenticar su identidad sin elevar roles, según el contrato aprobado.
- El token PERSONAL no habilita `GET /v1/labor/entries` histórico cross-tenant. Es otra proyección, con propiedad distinta y datos permitidos.

### F1B-B — Custodia de registros mínimos (segundo)

- Definir esquema/versiones de *recibos personales derivados* con `ownerUserId`, origen, hash, `retentionClass`, `recordClass`, estado y claves administradas con aislamiento.
- Elegibilidad personal estricta: registros propios de tiempo y notas no confidenciales; excluir por defecto Job, fotos, GPS, clientes, datos de compañeros y salarios de organización.
- `TimeEntry` permanece canónico y editable sólo por su FSM; copia derivada sólo lectura con versionado explícito.
- Para nuevas entradas personales elegibles, outbox atómico ligado a fuente, proyector idempotente; no bloquear reloj por retraso en copia. Marcar falla de proyección y reintentos.
- Backfill histórico sólo tras firma de política de privacidad/retención y autorización de archivos de empresa. No barrer tenants por ID de autor con acceso global.

### F1B-C — Lectura y exportación self, UX (tercero)

- Contrato de API `/me/personal-records` revisado con API_SURFACE y OWASP/API scope; sin `tenantId` como permiso de cliente.
- Paginación orden total, exportación íntegra con corte comprobable, contabilidad `recordCount`, UTC/IANA, status `confirmed/derived/pending`; interoperar F1A sin tener dos motores CSV divergentes.
- No exponer enlaces `fileUrl` públicos ni datos de cliente. Step-up para exportación masiva y límite por volumen.
- UI ES/EN: historial personal aparece cuando no hay Org; no mostrar datos de antiguo patrón fuera de la política elegible.

### F1B-D — Integridad, recuperación y retención (cuarto)

- Ensayo sintético de eliminación o suspensión de tenant y recuperación del recibo personal, con original `source_unavailable` y hash/procedencia.
- Retención, legal hold y borrado por DataClass, gestión de claves y backups autorizados; la eliminación lógica no equivale a borrar medios.
- Prueba de suspensión global `User`: denegar sesiones personales y empresariales según Security.
- Migración additiva expand/contract sólo cuando el diseño de esquema sea aprobado; cambios de `AuthSession` requieren compatibilidad retroactiva y prueba de performance.

## 4. Pruebas de seguridad y correctitud

| Prueba | Esperado |
|---|---|
| A sin ninguna Membership activa | Puede obtener sólo sesión personal tras auth sólida; ningún recurso corporativo |
| A sesión ORG X revocada | No puede crear/read de X; sesión personal independiente según User.status |
| A dueño de archivo personal y B mismo tenant | A puede; B denegado sin enumeración |
| A con membership en tenant Y | Y no ve archivo personal de origen X por tenant/org |
| Personal token contra `/v1/labor/entries`, pagos, admin, Evidence, Agents, SSE | Denegación explícita, sin fallback a claims |
| User global suspendido | Personal/ORG fail-closed según política |
| Tenant X delete sintético + copia confirmada | Copia elegible permanece según retención; fuente marcada ausente |
| Tenant X delete antes de proyección confirmada | NO afirmar que la copia existe; alertar recuperación/deuda |
| Corrige TimeEntry origen | Nueva revisión o estado del archivo, no edición silenciosa |
| Job o GPS sensible | Excluido salvo contrato de dato/autorización específicos |
| Logout/refresh/concurrencia | Revocación y rotación seguras; no elevar roles |
| Persona distinta usa URL de export | 404/403 neutro; descarga denegada |
| Integración F1A >500, archived, offline ES/EN | Un solo modelo de export sin cortes/truncamientos |

## 5. Datos y migración

- `AuthSession`: evaluar variant de principal usando migración segura, NO poner null globalmente `tenantId/orgId` sin auditar downstream; alternativa tipo discriminado de sesión compatible si Identity lo aprueba.
- `PersonalRecordReceipt`: nombre conceptual, **no crear tabla hasta aprobación**; almacenamiento cifrado independiente del cascade de tenant origen y sin compartir claves con Org.
- `TimeEntry` no migra de tenant, `createdBy` ni `orgId` no cambian; las API empresariales no leen recibos personales.
- Cualquier migración: SQL versionado, checksum, prueba de Postgres, backup/rollback/forward-fix. Nunca `prisma db push` en producción.
- Proyección y export descargable son datos de sensibilidad alta: cuotas, TTL, cero logs de notas, objetos privados con acceso autenticado.

## 6. Revisión, despliegue y CI (últimos gates)

1. Specs y ADR aprobados, consentimientos, privacy, auth contract.
2. Tests rojos de segregación PERSONAL/ORG y tenant cascade.
3. Implementación mínima por slices, revisiones intermedias.
4. Staging sintético y smoke autenticado A/B/C, revocación, sin Org, recuperación, mobile, ES/EN; latencia Auth medida.
5. Review independiente Security/Privacy/DB, restore y rollback.
6. **CI último:** `pnpm spec:index`, `pnpm spec:validate:strict`, `pnpm spec:coverage`, tests de auth+labor, typecheck/build/lint; checks terminales.
7. Merge/deploy/canary/activación sólo con autorización separada, evidencia y monitoreo.

## 7. Riesgos abiertos / no resueltos

- Seguridad de principal PERSONAL y revocación de AuthSession.
- Propiedad legal de anotaciones realizadas en el sitio del cliente.
- Fuente de verdad de custodia si un Tenant empresarial se elimina.
- Backfill no autorizado y volumen/costo de recibos.
- Diferencias entre export personal derivado y timesheet empresarial confirmado.
- Retención, supresión, legal hold y backups.
- Aprobación de programa #1035 antes de enlazar especificaciones en main.

**No se han ejecutado pruebas, migraciones ni desplegado servicios.**