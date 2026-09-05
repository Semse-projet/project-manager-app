# Reporte — Alineación SEMSE OS, Spec Drive, Spec Kit y Harness

**Fecha:** 2026-07-19
**Riesgo:** L0 documental

## Resultado

- Se definió el golden path Spec Kit -> specs -> Forge -> Agent Harness.
- Se declaró `.semse-sdd/` como kit histórico/de compatibilidad.
- Se creó un spec `DRAFT` para Capability Control Plane; no autoriza código.
- Se alinearon las fuentes de gobierno del repositorio.

## Skills

Se siguió `skill-installer`. El catálogo remoto no pudo consultarse porque el
host no dispone de `python` ni `py`, requeridos por el instalador oficial. No se
instaló Python ni se improvisó una instalación alternativa. Las skills de
GitHub, Next.js, React, Supabase/Postgres, navegador, Vercel y OpenAI ya están
expuestas por el entorno.

## Validación

- `pnpm spec:index`
- `pnpm spec:validate`
- `pnpm spec:validate:strict`

Durante la validación se detectó que `searchRepo` recorría los mismos árboles de
fuentes una vez por cada spec. Se añadió una caché por raíz, limitada a la vida
del proceso del CLI, para mantener la validación aproximadamente lineal sin
cambiar sus reglas ni resultados.

También se corrigió el parser para frontmatter con CRLF, se retiraron referencias
a tests inexistentes y se degradaron a `REVIEW` los specs de Weather y
Multi-stage Releases cuyas superficies declaradas no existen en el código. Esto
evita presentar contratos parciales como implementaciones verificadas.

Finalmente se normalizó metadata canónica faltante en los specs de Prometeo
Copilot, Memory, Orchestrator, Sense Workspace y Materials Calculator, usando
solo archivos y pruebas existentes.

## Riesgo residual

El spec permanece `DRAFT`. Requiere aprobación humana y completar sus contratos
pendientes antes de crear plan, tareas o código.

## Resultado final de verificación

- `node --test tests/unit/spec-lib.test.mjs`: 3/3 tests pasaron.
- `node scripts/spec-index.mjs`: índice regenerado con 78 specs.
- `node scripts/spec-validate.mjs --strict`: 0 errores, 0 advertencias.
- `pnpm` no está disponible en PATH; se ejecutaron directamente los scripts Node
  versionados, sin cambiar la semántica de la validación.

## Continuación: contratos y entorno reproducible

- El Control Plane pasó de `DRAFT` a `REVIEW`; no se autoaprobó.
- Se definieron manifests, installations, operations, deployment plans,
  runtime adapters, FSM, eventos, idempotencia y reconciliación candidatos.
- Se agregó ADR-023, threat model, SLO y verification matrix.
- Se alinearon arquitectura vigente, roadmap y matriz de implementación.
- Se reparó `docker-compose.yml`: Dockerfile, puerto, health endpoint y secreto
  local coherentes con la API vigente.
- Se creó `.devcontainer/` con Node 22, pnpm, Docker/GitHub CLI, PostgreSQL,
  Redis, MinIO, MailHog y perfil opcional de Ollama.

### Docker Desktop en el host

El host no tenía Docker. Se autorizó e intentó instalar
`Docker.DockerDesktop` mediante Winget dos veces. El instalador no produjo
progreso observable en esta terminal no interactiva y no quedó registrado como
instalado. Los procesos Winget iniciados fueron cerrados. Por ello:

- JSON del Dev Container: validado.
- Compose config/build/up/health: pendiente de Docker Desktop interactivo.
- Comando documentado: `winget install --id Docker.DockerDesktop --exact`.

### Cobertura SDD

`node scripts/spec-coverage.mjs` reportó 78 specs, 72 con tests relacionados,
45 VERIFIED, un spec en REVIEW sin código relacionado y seis sin tests. No se
crearon referencias o tests ficticios para ocultar trabajo pendiente.

### Verificación final posterior a la continuación

- `devcontainer.json`: JSON válido.
- `spec-lib.test.mjs`: 3/3 tests pasaron.
- `spec-index.mjs`: 78 specs indexados.
- `spec-validate.mjs --strict`: 0 errores, 0 advertencias.
- `spec-coverage.mjs`: 72/78 specs con tests relacionados.
- `check-dockerfile-workspace-packages.mjs`: 12 paquetes y 3 apps cubiertos.

## Cierre del paquete de revisión

- Se creó WorkItem `CP-REVIEW-001` con alcance L3, herramientas permitidas y
  prohibidas, disciplinas revisoras y criterios de aceptación.
- Se creó DecisionPackage con recomendación `revise`: listo para revisión, no
  para autoaprobación.
- Se añadieron dos pruebas estáticas para Compose y Dev Container; 2/2 pasan.
- Se alineó `AGENT_PROTOCOL.md` con la jerarquía canónica vigente.
- `ECOSYSTEM_STATUS.md` y `08_SPRINT_BACKLOG.md` quedaron marcados como snapshots
  históricos para impedir que agentes ejecuten migraciones o sprints obsoletos.
- Se creó el `WORK_SESSION_LOG.md` requerido por governance.
- Digest entregado a revisión:
  `sha256:dc1edb5973bf6b51b3ff6708ec21d9cae7cf314d5f42dab4b0b893afb630f6b0`.

## Revisión oficial Docker/Dev Containers

Se contrastó el kit local con documentación primaria de Docker y Development
Containers. El orden de Compose se confirmó correcto y `forwardPorts` se redujo
a Web/API; los sidecars mantienen sus puertos Compose y DNS interno. La evidencia
y fuentes quedaron en
`docs/research/SEMSE_DOCKER_DEVCONTAINER_REVIEW_2026-07-19.md`.

## Aprobación del spec y creación del plan

El owner humano aprobó el digest de revisión
`dc1edb5973bf6b51b3ff6708ec21d9cae7cf314d5f42dab4b0b893afb630f6b0`
para crear el plan técnico. La autorización excluye tasks, implementación,
migraciones, deploy y producción.

El spec se promovió a `APPROVED` con `approval_scope: plan_only`. Se creó
`docs/specs/platform/semse-os-control-plane.plan.md` en estado `DRAFT`.

Digests de entrega:

- spec aprobado: `sha256:54e8506324049e9defc2b0ca8118656520b4e0f4a7b09d2ff79ec32dc3460431`;
- plan draft revisado: `sha256:644c2b21ff24264d4623494286cac314e9574cec8566dd7baff166303beabfd7`.

## Revisión cruzada del plan

La revisión de Architecture, Security, Governance y QA detectó dos brechas de
diseño: los approvals existentes no prueban doble control de infraestructura y
el executor necesitaba identidad/permisos separados del administrador. El plan
ahora define `CapabilityOperationApproval`, prohíbe autoaprobación, exige dos
actores humanos para riesgo critical y separa `CAPABILITY_EXECUTOR` de
`OPS_ADMIN`. También fija Ollama por versión/digest y nunca `latest`.

El dictamen continúa condicional: ADR, threat model, FSM/eventos, permisos,
primer slice y prueba Compose real conservan sus gates humanos/técnicos. En ese
corte aún no se habían generado tasks ni implementación.

### Verificación posterior al plan revisado

- tests unitarios/estáticos: 5/5 pasaron;
- catálogo: 78 specs indexados;
- validator strict: 0 errores, 0 advertencias;
- cobertura declarada: 72/78 specs con tests relacionados;
- Dockerfiles: 12 paquetes workspace y 3 apps cubiertos;
- digest del plan reconfirmado después del arnés:
  `sha256:644c2b21ff24264d4623494286cac314e9574cec8566dd7baff166303beabfd7`.

## Aprobación del plan y generación de tasks

El owner aprobó el plan revisado con digest
`644c2b21ff24264d4623494286cac314e9574cec8566dd7baff166303beabfd7`
únicamente para generar `tasks.md`. El plan quedó `APPROVED` con scope
`tasks-only`; su digest promovido es
`sha256:5eaf03d11dc5de1dc6e83a4e5afd4aafed003c9cb1a798fffb989b27d8eb5eab`.

Se generó `semse-os-control-plane.tasks.md` con:

- 90 IDs únicos;
- T-000 completada por el registro documental;
- T-006 bloqueada por Docker Desktop ausente;
- 88 tareas pendientes y 0 tareas de implementación completadas;
- gates T-001..T-007 separados de la autorización de implementación T-008;
- tests-first, scopes de archivos/herramientas, roles Builder/Verifier,
  TaskPackets Forge y trazabilidad CP-001..CP-015;
- `implementation_authorized: false` y `production_authorized: false`.

Digest de tasks:
`sha256:62eeb221dcf408e61df085d73aaf26428bf44d29275e3f83cb1f50fb5c4d3714`.
No se ejecutaron reviews F0, código, Prisma, instalaciones, Docker, deploy o
producción.

### Verificación posterior a tasks

- 78 specs indexados;
- validator strict: 0 errores y 0 advertencias;
- regresiones estáticas: 5/5 pasaron;
- cobertura declarada: 72/78 specs con tests relacionados;
- Dockerfiles: 12 packages workspace y 3 apps cubiertos;
- contrato del task graph: 90 IDs únicos, 1 completado, 1 bloqueado,
  `implementation=false`, `production=false`;
- digests recalculados y coincidentes con plan, tasks, WorkItem y
  DecisionPackage.

## Ejecución autorizada de F0 documental

Sobre el digest de tasks
`62eeb221dcf408e61df085d73aaf26428bf44d29275e3f83cb1f50fb5c4d3714`,
el owner autorizó T-001..T-005/T-007 e inspección read-only de T-006. Resultado:

- ADR-023 `ACCEPTED` para diseño;
- threat model `ACCEPTED` con controles TOCTOU, path/symlink, broker identity,
  red default-deny, output limits y transacciones sin I/O externo;
- FSM y diez eventos v1 incorporados a catálogos canónicos;
- authorization model default-deny y dual control aceptado;
- slice `local-ai-runtime` aceptado solo para canary local futuro;
- migration design package aceptado; ruta futura reservada, no creada;
- T-006 bloqueada: Docker/Docker Desktop/procesos ausentes y WSL no instalado;
  Winget no pudo consultar por falta de sesión válida.

La skill `supabase-postgres-best-practices` guio índices de FKs/consultas,
constraints, timestamps UTC, lock ordering, transacciones cortas y
`SKIP LOCKED`. Se conservó CUID y no se introdujo RLS/UUIDv7 para no ampliar el
scope actual.

Estado posterior: 90 tasks, 7 completas, 1 bloqueada y 82 pendientes; código de
implementación completo: 0. Digests vigentes:

- plan posterior a F0:
  `sha256:0061f87bd22fc6f0d29b8c5827b8a31c2e55a277af5cb04a8dd110308405d489`;
- tasks posterior a F0:
  `sha256:3944e09d5ee55c84f2172847b61979e54cae0b62988e8c573e55e0094bcfd2ae`.

T-008+, código, Prisma, migration SQL/folder, instalación, Docker, deploy y
producción permanecen sin autorización.

### Verificación posterior a F0

- 78 specs indexados;
- strict validator: 0 errores y 0 advertencias;
- regresiones estáticas: 5/5 pasaron;
- task graph: 90 IDs únicos, 7 completas, 1 bloqueada y 82 pendientes;
- ruta de migration futura confirmada ausente;
- `implementation_authorized=false` y `production_authorized=false`.
