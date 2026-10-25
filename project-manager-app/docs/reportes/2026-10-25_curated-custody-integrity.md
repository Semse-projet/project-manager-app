# Biblioteca Técnica — integridad de custodia y camino de activación

Fecha: 2026-10-25. Entrega local de código; objetivo completo todavía no alcanzado.

## Mandato vigente y alcance

El propietario indicó: «Continúa la misión es completar sharing,publicación y RAG siguen sin habilitarse dejarlos habilitados dejando al CI de último». Se toma como autorización para continuar implementación pese al DRAFT documental y para ordenar CI al final; no se inventan dictamen independiente, consentimiento de terceros ni revisiones de fichas. No se vuelve a solicitar aprobación de producto.

Base de esta rama: #1010 `a485f6ab10c10b597f81effceab2638b9090aca9`, sobre #1008 `1b2d9846fb1d3dbcef06870f6885b68c5ac5906f`. Ambos confirmados abiertos y DRAFT. #987 continúa abierto/DRAFT en `a4162548d30eb8e17fa54b286de05f0929963f92`; #974 abierto. No se atribuyen a esos HEAD los resultados históricos de CI de sus descripciones. No se ejecutó ni reintentó CI.

La rama local `feat/curated-integrity-20261025` contiene una migración posterior a F1A; no se reescribe la migración original. No se modificaron Railway, variables, datos reales, permisos de usuarios, revisiones GitHub ni hilos.

## Corrección preparada

| Hallazgo #1010 | Cambio | Comprobación y límite |
|---|---|---|
| Delete/recreate de versión | Reserva durable del ID y `(tenantId,entryId,version)` sin cascada al contenido; prohibición de modificar, eliminar o truncar reservas | Rechazos SQL comprobados, incluyendo borrado de una versión sin consentimientos |
| Retirada no monotónica/evidencia mutable | Sólo se permite la transición de retirada; identidad y evidencia quedan inmutables. Reserva de ID de consentimiento evita replay tras borrado | Rechazo de reactivación y modificación; reintento idéntico permitido; nuevo consentimiento con nueva identidad |
| Procedencia mutable | Snapshot privado por versión capturado por trigger desde Entry, bloqueando cambios concurrentes a la fuente durante captura | Versiones nuevas conservan su procedencia; las anteriores a la migración quedan con `sourceCapturedAt=NULL`, sin inventar historia |
| Actor no persistido | FK RESTRICT de firmante y actor de retirada hacia User, más coherencia fecha/actor de retirada | Actor inexistente rechazado. Esto no acredita membresía, mandato, sesión ni derechos |
| Duplicados activos | Índice único parcial de identidad de concesión, con `NULLS NOT DISTINCT` para contribuidor sin organización titular | Duplicado secuencial rechazado. Test de dos conexiones escrito, todavía NO EJECUTADO en PostgreSQL nativo |

La identidad activa incluye tenant, versión, tipo/usuario firmante, organización titular, alcance, finalidad y hashes de contenido/política. Cambiar aviso no permite duplicar un permiso activo. Una concesión vencida sigue reservada hasta retirar su registro mediante el futuro flujo auditado; caducidad no autoriza lectura. La retirada HTTP idempotente por request key, auditoría y outbox pertenecen a F1B y no se dan por implementados.

Las reservas sólo contienen identificadores opacos, no texto ni firmas. Su retención y las políticas de purga siguen sujetas a revisión competente. La migración no concede al runtime DDL ni bypass de triggers. La purga física no es una API pública de esta entrega.

## Evidencia propia

- `spec-validate --strict`: 203 specs, 0 errores y 0 advertencias; índice y `git diff --check` PASS.
- Prisma 6.19.3: validación de esquema y generación de cliente PASS.
- TypeScript 5.8.3: comprobación enfocada del test de integración PASS, sin emitir código; no equivale al build del monorepo.
- Motor embebido PGlite 0.3.14 (PostgreSQL 17.5 compilado a WASM): **17 comprobaciones SQL PASS**, aplicando los dos archivos reales de migración curada sobre tablas mínimas Tenant/Org/User sintéticas. Después de migrar se usa un rol SQL sin privilegios de superusuario ni propiedad de las tablas.
- Baseline anterior a la corrección: reproducidos delete/recreate, retirada revertida, duplicado activo y firmante inexistente. La corrección rechaza esos comportamientos.
- La migración rechaza firmantes huérfanos y duplicados preexistentes con rollback transaccional, sin tablas de reserva parcialmente creadas. No crea usuarios ficticios ni borra evidencia para conseguir migrar.
- Procedencia: una versión antigua permanece desconocida; las nuevas capturan S1/S2 y no siguen mutaciones posteriores de Entry.
- Se conserva el CHECK privado DRAFT/ORG_PRIVATE; este slice no elimina prematuramente la prohibición de publicación.

Reproducción del diagnóstico opcional:

```sh
# Instalar el motor en un directorio temporal independiente del monorepo:
npm install --prefix /tmp/curated-check --ignore-scripts --no-audit --no-fund @electric-sql/pglite@0.3.14
# Desde project-manager-app/:
CURATED_PGLITE_MODULE=/tmp/curated-check/node_modules/@electric-sql/pglite/dist/index.js node scripts/curated-custody-embedded-check.mjs
```

El script es un diagnóstico optativo sin conexión a bases externas. No modifica package.json, lockfile ni workflows. No sustituye la integración normal del repositorio.

### Pruebas pendientes o bloqueadas

PostgreSQL 16 nativo no pudo iniciarse: el entorno sólo mapea UID 0; cambiar a usuario sin privilegios y crear un namespace de usuario fueron rechazados por el sistema. PostgreSQL no admite ejecución como root. No se alteró esa protección. PGlite es una conexión embebida: **no demuestra concurrencia real entre conexiones, migración de todo el monorepo, HTTP autenticado ni staging**.

El test ampliado `apps/api/test/curated-knowledge-private-custody-integration.test.ts` prepara usuarios reales sintéticos, retirada/evidencia, procedencia, reservas, FK y dos transacciones con clientes separados. Espera observar un bloqueo en `pg_stat_activity` desde un tercer cliente antes de liberar la primera inserción; no confunde dos promesas secuenciales con contención comprobada. Requiere PostgreSQL migrado y tres conexiones disponibles. No se reporta como ejecutado.

## Lo que falta para el objetivo completo

| Orden | Entrega | Criterio de cierre |
|---|---|---|
| 1 | Cerrar integridad F1A | Ejecutar suite ampliada sobre PostgreSQL 16 y migraciones completas; revisar el delta de esta rama |
| 2 | F1B consentimiento y retirada autenticados | Identidad humana de sesión, membresía vigente, autoridad del titular comprobada, política/hash versionados, idempotencia durable y audit/outbox atómicos; pruebas de rollback y de actor ajeno |
| 3 | F2 publicación y sharing curado | Persistir cualificación/autoridad verificables, dos revisores humanos distintos e independientes, step-up, FSM y CAS; retirar bloquea lectura nueva desde commit |
| 4 | #987/#974 y F3 RAG | Integrar aislamiento del RAG original y cuarentena legacy, desplegar/verificar dependencia, FTS-only sobre derivados con audiencia+consentimiento+revisiones vigentes en el mismo SQL que devuelve contenido/citas/conteos |
| 5 | Validación de activación | Staging aislado con sesiones sintéticas A/B/C, revisión competente, cero egreso privado, rollback de app conservando revocación; CI final sobre el SHA resultante |
| 6 | Activar y verificar | Tenant piloto autorizado y fichas realmente consentidas/revisadas; monitorizar acceso/retirada. Ninguna exposición de originales, cross-tenant ni permisos globales |

La revisión general de seguridad del SDD/ADR sigue sin persona asignada. Es distinta de los dos revisores por ficha que exige F2. La inspección de KnowledgeModule y de los modelos curatoriales no encontró todavía la implementación de esos controles. Los recibos del módulo Contracts no son autorizaciones de biblioteca y no se reutilizan como si lo fueran.

## Dictamen de esta entrega

Implementación de integridad preparada y comprobada en el alcance SQL embebido. **Activación BLOQUEADA por funcionalidad todavía pendiente y ausencia de pruebas/revisión requerida**, no por haber decidido aplazar CI. No se afirma que sharing, publicación o RAG estén habilitados. No se consultó ni cambió el valor de flags en producción.

La condición del SDD, sección F5, sigue siendo: «No activar mientras falte evaluación independiente». El mandato de completar la misión permite desarrollar; no suministra esa evaluación ni las firmas de los titulares. No se inventan responsables ni aprobaciones.
