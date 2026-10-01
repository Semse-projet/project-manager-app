# Programa de cierre SEMSE C00–C81

**Creado:** 2026-09-30 · **Main base:** `69c4f04` · **Baseline:** auditoría canónica 2026-09-11 (C01–C80) + C81
**Registro máquina-legible:** [`semse-closure-registry.json`](semse-closure-registry.json) (una fila por capacidad; evidencia de código/CI/merge/deploy/activación separada — C79).

> C00 no es una capacidad: es el gate administrativo/baseline de este programa. No se le asigna alcance.
> Ninguna capacidad pasa a `VERIFIED` sin tests + CI terminal + merge SHA + deploy + health + smoke autenticado/canary + evidencia registrada.

## Reglas de avance (no saltarse nada)
1. Se trabaja **un lote a la vez**, en el orden de la tabla. No se abre el siguiente hasta que el anterior no tenga bloqueo de seguridad/datos/dinero.
2. Cada capacidad del lote entra en un PR acotado (o PR por lote si son pequeñas) siguiendo SDD: spec `APPROVED` → plan → tareas → tests primero → implementación → `pnpm spec:validate:strict` → checklist → reporte en `docs/reportes/`.
3. Delta-reconciliation por C: leer código/specs/tests/ADR → clasificar (`VERIFIED | IMPLEMENTED_NOT_VERIFIED | PARTIAL | BROKEN | DUPLICATED | DESIGNED_ONLY | OBSOLETE_FINDING`) → propietario canónico → implementar sólo el hueco real.
4. Duplicadas: ADR → propietario canónico → callers listados → adaptador de compatibilidad → migrar → tests de regresión → observar tráfico → *entonces* deshabilitar/retirar. Nunca borrar primero.
5. Diseñadas: contrato primero; port real + adaptador fake + flag de producción apagado; no se declara ACTIVE sin canary real.
6. Acciones destructivas, deploys, migraciones en producción y cambios de Railway/CI/env requieren confirmación explícita del usuario (AGENTS.md).
7. Cada lote termina con el **paquete de evidencia**: Cs tocadas (antes/ahora/final), archivos, migraciones, tests con conteos, typecheck/build/spec, PR + SHAs, deployment IDs, smoke/canary, bloqueos, filas de registro actualizadas.

## Definition of Done por capacidad (checklist copiable)
- [ ] AS-IS reconciliado · [ ] propietario canónico · [ ] contratos/versionado · [ ] migración aditiva + rollback
- [ ] auth/tenant/org/resource scope (+ tests negativos) · [ ] implementación · [ ] observabilidad/auditoría (EVENT_CATALOG)
- [ ] unit/integration/e2e · [ ] typecheck/build · [ ] CI terminal · [ ] merge SHA · [ ] deploy/migración · [ ] health
- [ ] smoke autenticado/canary · [ ] evidencia registrada · [ ] fila del registro actualizada

## Lotes (orden de ejecución)
| Lote | Ola | Alcance | Capacidades | Depende de |
|---|---|---|---|---|
| **A1** | A | Privacidad IA y gobierno de herramientas | C80, C39, C46 | — |
| **A2** | A | Dinero: Stripe, release único, waivers, payouts | C26, C27, C28, C29 | ADR C27 + spec SDD |
| **A3** | A | Tenant/org, ResourceScope, identidad, Agro | C51, C10, C11, C49 | A2 (scope de pagos) |
| **A4** | A | Evidence canónico, persistencia e hitos | C67, C19, C18 | A3, ADR-028 |
| **A5** | A | Entrega, datos y continuidad | C62, C02, C56, C55, C57 | — (paralelizable; C57 tras C55) |
| **A6** | A | Regresión REAL P0 + cierre de ola | C01, C05 | A1–A5 |
| **B1** | B | Identidad, actores y demanda | C08, C09, C12, C14, C15, C07 | A3 |
| **B2** | B | Labor: TimeEntry único, timer, offline; build y Ollama | C65, C22, C23, C03, C41 | A3 |
| **B3** | B | Operaciones y evidencia (resto) | C20, C21, C17, C25, C24 | A4 |
| **B4** | B | Economía, contratos, trust y storage | C30, C68, C31, C32, C33, C72 | A2, A4 |
| **B5** | B | Comunicaciones, AI/Knowledge, eventos, headers, registro | C36, C42, C45, C47, C52, C58, C59, C79, C53 | A1, A5 |
| **C1** | C | Consolidaciones no críticas | C60, C66 | B5 |
| **C2** | C | Operación/UX/integraciones | C13, C16, C34, C35, C37, C38, C44, C48, C50, C61, C64, C70, C73, C74, C75, C76, C77, C78 | B |
| **C3** | C | Regresión REAL P2 | C04, C06, C40, C43, C54, C63 | B |
| **D1** | D | Extensiones experimentales (sin autoridad financiera) | C69, C71 | A1, A2, C2 (C70) |
| **E1** | E | Experimentation (shadow → canary interno) | C81 | B5 (flags/obs), A1 |

**Estado de lotes (2026-09-30):** A1 — C80/C39/C46 en main (#698, #700, #710); migración aditiva 105 (actor/política en logs de IA, versión de plan) APLICADA en producción (deploy 70ca14b8, aecbd8d; 4 servicios online); faltan precios (costo) y eventos de denegación. A2 — ADR-041 ACCEPTED/spec APPROVED (aprobación explícita del owner); slice 1 en main (#709); D2 (dual approval) sin definir; C26 (#705) y C28 (#703, #709) con avance. A3 — C10: evidence-gateway (#702), liens (#703), worker-verification (#704) en main; archivos públicos (C19) con spec DRAFT (#708). A5 — C02 (#706) en main; C56/C57/C55 con evidencia de producción de solo lectura (#711); C57 propuesta de dry-run y retiro de funciones huérfanas pendiente de autorización; C55 backups pendiente de confirmación del operador. C03 build verificado en main. **2026-10-01:** mergeados #713 (evidencia de despliegue), #714 (C57: dedup fuera del arranque), #715 (C19: URLs firmadas, modo off) y #716 (C02: verificador de procedencia); C03 y C80 pasan a VERIFIED por criterio de cierre (el smoke destructivo en producción queda como columna aparte, no ejecutado). **Importante:** el merge a `main` despliega solo a Railway tras el CI de main (los commits fusionados seguidos se agrupan en un único despliegue); ninguna capacidad es VERIFIED sin smoke autenticado. Resto: no iniciado.

Notas de orden: A2 va antes que A3 porque el scope de pagos define el patrón tenant+org+recurso; C65 (B2) y C67 (A4) consolidan a través de su propietario canónico (Labor Engine / `evidence/`); C69/C71 (D1) nunca tienen autoridad financiera directa; C81 (E1) prohíbe aleatorizar autorización, identidad, liberación de pagos, decisiones legales o compuertas de seguridad.

## Registro de capacidades
| ID | Capacidad | Dominio | Prio | Histórico | Lote | Estado actual |
|---|---|---|---|---|---|---|
| C01 | Origen configurado API/Web/Worker/Vision | Infraestructura | P0 | REAL | A6 | REAL — 4 servicios de app con origen repo Semse-projet/project-manager-app (Railway) |
| C02 | Trazabilidad de versiones activas | Entrega | P0 | PARCIAL | A5 | PARTIAL — en main: #706 (campos de procedencia) y #716 (edc63eb, verify-deploy-provenance.mjs, solo lectura). Falta: gate en CI que compare sha en producción con el commit mergeado (requiere autorizar cambio de CI/CD) y imageDigest (SEMSE_IMAGE_DIGEST) |
| C03 | Compilación candidato web 5-sep | Entrega | P1 | ROTA | B2 | VERIFIED (por criterio de cierre) — defecto reparado y build reproducible del commit reconciliado (local exit 0 + CI main success); web desplegada y online. Smoke autenticado/destructivo en producción: no ejecutado (columna aparte) |
| C04 | Página pública app.semseproject.com | Web | P2 | REAL | C3 | NOT_STARTED |
| C05 | Health de API (Railway y dominio) | API | P0 | REAL | A6 | NOT_STARTED |
| C06 | Health propio del BFF web | Web | P2 | REAL | C3 | NOT_STARTED |
| C07 | Rechazo de acceso anónimo | Identidad | P1 | REAL | B1 | NOT_STARTED |
| C08 | Login, sesión y recuperación | Identidad | P1 | PARCIAL | B1 | NOT_STARTED |
| C09 | Identidad universal y múltiples roles | Identidad | P1 | PARCIAL | B1 | NOT_STARTED |
| C10 | Aislamiento tenant + organización | Identidad | P0 | ROTA | A3 | OPEN — en main: evidence-gateway (#702), liens (#703), worker-verification (#704); persistir verificación, URLs de archivos (C19) e intelligence pendientes |
| C11 | Precondiciones de atestación de identidad | Trust | P0 | PARCIAL | A3 | NOT_STARTED |
| C12 | Relación compañía/profesional/worker | Actores | P1 | PARCIAL | B1 | NOT_STARTED |
| C13 | Originador, referidos e incentivos | Actores | P2 | PARCIAL | C2 | NOT_STARTED |
| C14 | Intake público y wizard | Demanda | P1 | PARCIAL | B1 | NOT_STARTED |
| C15 | Estimación y cobertura por categoría | Estimación | P1 | PARCIAL | B1 | NOT_STARTED |
| C16 | Paquete de herramientas por oficio | ProTools | P2 | PARCIAL | C2 | NOT_STARTED |
| C17 | BuildOps: planificación y cuadrillas | Operaciones | P1 | PARCIAL | B3 | NOT_STARTED |
| C18 | Hitos y aprobación de avances | Operaciones | P0 | PARCIAL | A4 | NOT_STARTED |
| C19 | Persistencia de archivos de evidencia | Evidence | P0 | PARCIAL | A4 | PARTIAL — en main (#715, 0b97dc4), modo off por defecto: sin efecto hasta configurar UPLOADS_SIGNING_SECRET y pasar shadow→enforce (operador). La exposición pública actual de GET /v1/uploads/files/* sigue abierta hasta esa activación |
| C20 | Estados, rechazo, reemplazo y archivo | Evidence | P1 | PARCIAL | B3 | NOT_STARTED |
| C21 | Integración de análisis visual | Evidence | P1 | PARCIAL | B3 | NOT_STARTED |
| C22 | Timer y proyectos libres | Labor | P1 | PARCIAL | B2 | NOT_STARTED |
| C23 | Offline, ubicación y captura móvil | Labor | P1 | PARCIAL | B2 | NOT_STARTED |
| C24 | Proyectos, propuestas y contratación | Marketplace | P1 | PARCIAL | B3 | NOT_STARTED |
| C25 | Change Orders y control de alcance | Operaciones | P1 | PARCIAL | B3 | NOT_STARTED |
| C26 | Configuración de Stripe | Payments | P0 | PARCIAL | A2 | PARTIAL — en main (#705): webhook Stripe fail-closed; falta proveedor/modo por entorno y reconciliación |
| C27 | Gobernanza de liberación y dual approval | Payments | P0 | DUPLICADA | A2 | PARTIAL — ADR-041 ACCEPTED/spec APPROVED; slice 1 (autorización única) en producción (deploy 70ca14b8, aecbd8d); faltan comando único con idempotencia, dual approval (D2 sin definir) y retiro del camino falso |
| C28 | Gate de lien waivers en escrow | Payments | P0 | PARCIAL | A2 | PARTIAL — en producción (aecbd8d): firma de waivers protegida (#703) y gate de waivers en release manual/agente (#709, enforced por defecto; rollback PAYMENTS_RELEASE_WAIVER_GATE=off); gobernanza completa en shadow (revisar logs release_governance_shadow_would_block antes de enforce); sin smoke |
| C29 | Fondeo, liberación, refunds y payouts | Payments | P0 | PARCIAL | A2 | PARTIAL — slice 1 de ADR-041 en producción; idempotencia/reconciliación (slice 2) pendiente |
| C30 | Registros de pagos y costeo por recurso | Economía | P1 | PARCIAL | B4 | NOT_STARTED |
| C31 | Integración de firma electrónica | Contratos | P1 | PARCIAL | B4 | NOT_STARTED |
| C32 | Resolución de controversias | Disputas | P1 | PARCIAL | B4 | NOT_STARTED |
| C33 | Reputación, credenciales y Trust Score | Trust | P1 | PARCIAL | B4 | NOT_STARTED |
| C34 | Propuestas, votos y créditos | Governance | P2 | PARCIAL | C2 | NOT_STARTED |
| C35 | Descubrimiento y matching | Connect | P2 | PARCIAL | C2 | NOT_STARTED |
| C36 | Configuración WhatsApp | Comunicaciones | P1 | PARCIAL | B5 | PARTIAL — hallazgo: webhook WhatsApp en modo mock sin firma (pendiente B5) |
| C37 | Inbox y continuidad de conversación | Comunicaciones | P2 | PARCIAL | C2 | NOT_STARTED |
| C38 | Configuración de correo | Comunicaciones | P2 | PARCIAL | C2 | NOT_STARTED |
| C39 | Configuración del router de modelos | AI | P0 | PARCIAL | A1 | PARTIAL — en producción: logs IA tenant-scoped + actor/org/política persistidos; migración aditiva 20260930230513 aplicada (deploy 70ca14b8); costo habilitado por AI_MODEL_PRICING_JSON, faltan precios del owner; sin smoke |
| C40 | Servicio Ollama | AI | P2 | REAL | C3 | REAL — ollama online pero imagen :latest y SIN volumen (modelos no persistentes) |
| C41 | Chat Ollama 6-sep (smoke e2e) | AI | P1 | ROTA | B2 | NOT_STARTED |
| C42 | RAG, embeddings y fuentes | Knowledge | P1 | PARCIAL | B5 | NOT_STARTED |
| C43 | Ciclos de curación / Product Intelligence | Worker | P2 | REAL | C3 | NOT_STARTED |
| C44 | Endpoint público de overview | Intelligence | P2 | PARCIAL | C2 | NOT_STARTED |
| C45 | Mission Control unificado | Operación AI | P1 | PARCIAL | B5 | NOT_STARTED |
| C46 | Plan Mode, políticas de herramientas y aprobación | Operación AI | P0 | PARCIAL | A1 | PARTIAL — en producción: piso de aprobación determinista + versión de plan y aprobación ligada a la definición (migración aplicada); falta denegación con eventos (EVENT_CATALOG); sin smoke |
| C47 | LiveKit / Prometeo Live | AI Live | P1 | PARCIAL | B5 | NOT_STARTED |
| C48 | App Expo, distribución y cobros | Móvil | P2 | PARCIAL | C2 | NOT_STARTED |
| C49 | Animales, lotes, costos, tareas y offline | Agro | P0 | PARCIAL | A3 | NOT_STARTED |
| C50 | Asistente electricidad de campo | Campo | P2 | SOLO_DISEÑADA | C2 | NOT_STARTED |
| C51 | ResourceScope y ciclo de vida transversal | Arquitectura | P0 | PARCIAL | A3 | NOT_STARTED |
| C52 | Outbox y consumidores | Eventos | P1 | PARCIAL | B5 | NOT_STARTED |
| C53 | Postgres servicio persistente | Datos | P1 | REAL | B5 | REAL — Postgres online (postgres-ssl:18, 1 réplica, 5 GB); 1 warning sin detalle; plan de restauración pendiente (C55) |
| C54 | Redis servicio persistente | Datos | P2 | REAL | C3 | REAL — Redis en sfo vs servicios en us-east4 (dependencia regional confirmada); recuperación de colas no verificada |
| C55 | Backups y restauración Postgres/archivos | Continuidad | P0 | PARCIAL | A5 | PARTIAL — inventario hecho (3 volúmenes 5 GB, archivos en /data local, sin buckets); estado de backups/restauración DESCONOCIDO vía MCP: requiere confirmación del operador |
| C56 | Migraciones y esquema productivo | Datos | P0 | PARCIAL | A5 | PARTIAL — evidencia prod: migración 105 (20260930230513) aplicada con 'migrate deploy completo' (deploy 70ca14b8); antes 104 sin pendientes; deriva schema↔tablas no medida |
| C57 | Deduplicación histórica | Datos | P0 | PARCIAL | A5 | PARTIAL — en main (#714, 31471b7): runDedup() fuera del arranque; scripts/maintenance/dedup.mjs (dry-run por defecto; --apply exige evidencia de backup + confirmación, tope de filas, transacción, canónica por dependientes/createdAt, grupos ambiguos bloqueados). Falta confirmar el despliegue (el arranque ya no debe loguear 'dedup complete'), backup/restore verificado antes de cualquier --apply, y retirar servicios huérfanos db-dedup-script y t051-t058a (decisión del dueño) |
| C58 | Cabeceras de protección web | Seguridad web | P1 | PARCIAL | B5 | NOT_STARTED |
| C59 | Permisos cámara/micrófono/ubicación web | Campo / Live | P1 | PARCIAL | B5 | NOT_STARTED |
| C60 | Inventarios públicos de módulos | Producto | P2 | DUPLICADA | C1 | NOT_STARTED |
| C61 | Bilingüismo y unidades de trabajo | Experiencia | P2 | PARCIAL | C2 | NOT_STARTED |
| C62 | CI, SDD, dependencias y cobertura | Calidad | P0 | PARCIAL | A5 | PARTIAL — no iniciado (siguiente) |
| C63 | Métricas de siete servicios 24h | Observabilidad | P2 | REAL | C3 | NOT_STARTED |
| C64 | Proyectos secundarios y cambios preparados | Infraestructura | P2 | PARCIAL | C2 | PARTIAL — recursos huérfanos en Railway: db-dedup-script (vacío), t051-t058a-onetime-count, parche staged vacío |
| C65 | Escritores paralelos de TimeEntry | Labor | P1 | DUPLICADA | B2 | NOT_STARTED |
| C66 | Frontend canónico y superficies de transición | Superficies | P2 | DUPLICADA | C1 | NOT_STARTED |
| C67 | Rutas canónica y EvidenceGateway | Evidence | P0 | DUPLICADA | A4 | PARTIAL — en main (#702): gateway usa política canónica; consolidación de código pendiente |
| C68 | Ledger compartido F5 doble entrada | Economía | P1 | SOLO_DISEÑADA | B4 | NOT_STARTED |
| C69 | Gateway MCP externo | Integraciones | P3 | SOLO_DISEÑADA | D1 | NOT_STARTED |
| C70 | Planificación, DAG y control de Forge | Forge | P2 | PARCIAL | C2 | NOT_STARTED |
| C71 | Forge LiveToolAdapter | Forge | P3 | SOLO_DISEÑADA | D1 | NOT_STARTED |
| C72 | Backend de objetos S3/R2 | Storage | P1 | SOLO_DISEÑADA | B4 | DESIGNED_ONLY — confirmado: sin buckets; almacenamiento solo en volumen local /data |
| C73 | Satélites, SDK y webhooks salientes | Integraciones | P2 | PARCIAL | C2 | NOT_STARTED |
| C74 | Clima, avisos y agenda | Operación | P2 | PARCIAL | C2 | NOT_STARTED |
| C75 | Materiales, viajes, facturas y gastos | Operación | P2 | PARCIAL | C2 | NOT_STARTED |
| C76 | Push y navegación móvil | Comunicaciones | P2 | PARCIAL | C2 | NOT_STARTED |
| C77 | Browser Agent de inspección | IA | P2 | PARCIAL | C2 | PARTIAL — en main (#702): subida de evidencia del Browser Agent verifica proyecto |
| C78 | Conocimiento repo/runtime y Graphify | Knowledge | P2 | PARCIAL | C2 | NOT_STARTED |
| C79 | Registro único y verdad de entrega | Gobierno | P1 | PARCIAL | B5 | NOT_STARTED |
| C80 | Propagación política local-only | Privacidad IA | P0 | ROTA | A1 | VERIFIED (por criterio de cierre) — restricciones de privacidad antes de overrides/fallbacks y prueba de denegación cuando falla el modelo local (#698), desplegado. Smoke destructivo en producción (Ollama caído): no ejecutado (columna aparte) |
| C81 | Experimentation (flags, cohortes, guardrails, rollback) | Experimentación | P3 | NUEVA | E1 | NOT_STARTED |

Recuentos: ROTA 4 · DUPLICADA 5 · SOLO_DISEÑADA 5 · PARCIAL 56 · REAL 10 · NUEVA 1 (C81) = 81.
