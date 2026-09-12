# P0 fixes from the 2026-09-11 audit — authorization, attestation, privacy

**Fecha:** 2026-09-11
**Rama:** `fix/audit-2026-09-11-p0-authz-privacy` (desde `origin/main@edfc19ef`)
**Fuente:** `SEMSEproject_Auditoria_2026-09-11.md` (auditoría independiente, más su companion `SEMSEproject_Reconciliacion_2026-09-11.md` y `SEMSEproject_Matriz_2026-09-11.csv`), entregados por el usuario. Reemplaza la matriz de 64 filas de julio.

## Alcance de esta sesión

De los 5 hallazgos P0 de la auditoría (F01–F07 con numeración salteada), esta sesión implementó los que son defectos de código concretos y acotados, verificados contra el código real antes de tocar nada (3 pasadas de exploración + lectura directa). **No** se tocó lo que requiere decisión de producto, investigación de infraestructura o acceso operativo — ver "Fuera de alcance" abajo.

## Cambios

### F02a — `PaymentGovernanceController`/`Service`/`Repository` no propagaban tenant/org

- `payment-governance.repository.ts`: `getEscrow(escrowId)` (→ `findUnique({ where: { id } })`, sin filtro de tenant) pasa a `getEscrow(escrowId, tenantId)` (→ `findFirst({ where: { id, project: { tenantId } } })`), el patrón ya establecido en el resto del código (`payments/payment-governance.service.ts`, `milestones.repository.ts`, `buildops.service.ts`).
- `payment-governance.service.ts`: `releasePayment`, `blockPayment`, `getPaymentHistory`, `calculatePaymentScore` y `checkReleaseBlockers` ahora reciben y propagan `tenantId`.
- `payment-governance.controller.ts`: los 4 handlers ahora resuelven `ctx = resolveRequestContext(req)` y pasan `ctx.tenantId` — antes solo `getDiagnostics` lo hacía.
- Efecto: un escrow de otro tenant ahora produce el mismo 404 "not found" que ya existía para IDs inexistentes — no se agregó una rama de error nueva, ni se filtra si el recurso existe en otro tenant.
- **No tocado a propósito:** `getPaymentScore`'s route (`@Get("escrow/:escrowId/score")`) no tiene segmento `:milestoneId`, así que ese `@Param` siempre fue `undefined` — bug preexistente, no relacionado con autorización, dejado fuera para no ensanchar el diff.

### F02b — `AgroFarmService.getUnit` no verificaba dueño

- `getUnit(unitId)` → `getUnit(unitId, ownerId)`: ahora resuelve la finca padre (`unit.farmId`) y compara `farm.ownerId`, exactamente el patrón que ya usaba `updateUnit` en el mismo archivo (que ahora delega en `getUnit` en vez de duplicar el chequeo).
- Controller: `getUnit` pasa `ctx.userId`, igual que `getFarm`/`updateUnit`/`listUnits` en el mismo controller.

### F04 — Atestación de identidad no era atómica con su aprobación

- `users.service.ts`, `reviewVerificationRequest`: cuando `decision === "approved"` y el tipo es atestable, `createIdentityAttestation(...)` ahora se llama **antes** de persistir el registro de decisión en workspace memory y antes de `verifyUser(...)`. Si la firma/persistencia de la atestación falla (claves ausentes, error de DB), el método lanza antes de que nada quede registrado como aprobado — sin registro de decisión, sin `User.verificationStatus="verified"`, sin auditoría, sin evento `user.verified`.
- No se introdujo `$transaction` (workspace memory y el domain event bus no comparten transacción Prisma con `User`/`IdentityAttestation`) — el mecanismo disponible y correcto es el ordenamiento: lo que puede fallar, primero.

### F05 — Privacidad no era inmutable en el ruteo LLM

Dos brechas independientes, ambas cerradas:

1. **Bypass en el router:** `AiModelRouterService.selectRoute()` comprobaba `forceModelSlug` antes que `privacyLevel` — un `forceModelSlug` a un modelo cloud ganaba sobre `privacyLevel: "local_only"`. Se invirtió el orden: privacidad se comprueba primero, `forceModelSlug` solo se atiende si la privacidad lo permite.
   - **Esto no era un caso teórico:** `POST /v1/agents/generate` (`ai-models.controller.ts`) construye el `AiGenerateRequest` con `...(body as Record<string, unknown>)` — cualquier llamador autenticado con el permiso `agents:run:create` puede fijar `forceModelSlug` él mismo. No era un "override de operador" de confianza como sugería el comentario del test anterior; era una entrada controlada por el llamador.
2. **Sin defensa en profundidad:** `AiModelGatewayService.executeWithSlug()` nunca pasaba `localOnly`/`privacyCritical` al `context` del orquestador, aunque el orquestador (`orchestrator.ts:118-129`) ya sabe excluir providers cloud de su fallback chain cuando los recibe. Se agregó: `localOnly`/`privacyCritical` derivados de `request.privacyLevel`, pasados siempre al orquestador — así el segundo guardia también se activa, independientemente de qué slug haya elegido el router.

**Se actualizó `ai-model-router-privacy.test.ts`:** el test `"forceModelSlug still wins over privacy level (explicit operator override, unchanged behavior)"` (de SPEC-GTW-001, 2026-08-27) codificaba exactamente el comportamiento que este hallazgo identifica como vulnerabilidad. Se reemplazó por dos tests: uno que confirma que privacidad gana sobre `forceModelSlug`, y otro que confirma que `forceModelSlug` se sigue respetando cuando la privacidad lo permite (no se rompió la funcionalidad de override, solo se le puso el límite correcto).

### F08 / C03 — Build de Web roto (`baseRate` indefinido)

- `labor-tool-client.tsx:61`: `baseRate[input.laborType]` → `BASE_RATES[input.laborType]` (la constante real, declarada en la línea 14). Una línea.

## Fuera de alcance (marcado explícitamente, no olvidado)

- **F01** (procedencia de imágenes/SHA de release) — requiere una auditoría de solo lectura contra Railway/GitHub, no un fix de código.
- **F03** (tres rutas de liberación de pago divergentes) — decidir un único camino económico es una decisión de producto/arquitectura, no algo para resolver unilateralmente en una sesión de fixes. `AGENTS.md` y el skill `semse-audit-remediation` de este repo piden sign-off humano explícito antes de tocar rutas de dinero.
- **F06** (limpieza automática en `pre-migrate`) — necesita una revisión de seguridad de DB antes de tocarlo, no un cambio de paso.
- **F07** (backups/restore no acreditados) — es una pregunta de plan/acceso de Railway, no de código.
- La configuración de `SEMSE_ATTESTATION_PRIVATE_KEY`/`SEMSE_ATTESTATION_KEY_ID` en Railway (mencionada junto a F04) es una tarea de operación del usuario — el código ya falla correctamente cuando faltan en un entorno productivo.

## Verificación

- `pnpm typecheck` — limpio, workspace completo.
- `pnpm lint` — 0 errores (36 warnings preexistentes, no relacionados).
- `pnpm build:web` — **build exitoso** (antes fallaba por el bug de `baseRate`).
- `pnpm build:api` — build exitoso.
- `pnpm --filter @semse/api test:unit` (2221 tests) — **2213 pass, 7 fail**. Las 7 fallas son exclusivamente `originator.service.test.ts` (`PrismaClientInitializationError: Can't reach database server at 127.0.0.1:5433`) — no hay Postgres local corriendo en este entorno; no están relacionadas con ninguno de los 5 cambios de esta sesión.
- `pnpm test:unit` (raíz, 1058 tests) — 1045 pass, 0 fail, 4 skipped, 9 todo.
- Tests nuevos agregados como regresión de los hallazgos cerrados (no solo el happy path):
  - `agro-farm.service.test.ts`: `getUnit`/`updateUnit` rechazan con `NotFoundException` cuando el owner no coincide.
  - `payment-governance-tenant-scope.test.ts` (nuevo): `releasePayment`/`blockPayment`/`getPaymentHistory`/`calculatePaymentScore` sobre el escrow de otro tenant — 404/null/degradado, nunca mutan ni filtran el recurso ajeno.
  - `users.service.test.ts`: una atestación que falla bloquea `verifyUser` y la solicitud queda "pending", nunca "approved".
  - `ai-model-router-privacy.test.ts`: `forceModelSlug` ya no puede saltarse `privacyLevel`; sigue funcionando cuando la privacidad lo permite.

**Lo que no se verificó en vivo:** no se ejecutó ningún acceso cross-tenant/cross-owner autenticado contra producción ni contra un entorno con DB real — todo lo anterior es análisis estático + pruebas unitarias con stubs, igual que el límite que la propia auditoría se puso a sí misma. No se afirma que haya habido explotación real de F02/F04/F05 en producción, solo que el defecto de código existía y ahora está cerrado con prueba de regresión.

## Estado

Cambios aplicados en la rama `fix/audit-2026-09-11-p0-authz-privacy`, no mergeados ni desplegados. `main` despliega automáticamente a Railway en cada push — el merge queda pendiente de revisión/aprobación explícita del usuario.
