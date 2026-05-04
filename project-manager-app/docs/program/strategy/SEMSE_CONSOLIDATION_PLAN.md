# SEMSE Consolidation Plan

## 1. Veredicto

SEMSE es un solo proyecto distribuido en varias piezas.

No debe tratarse como productos separados.
Debe tratarse como un ecosistema con:

- una vision oficial;
- un programa oficial;
- una implementacion canonica;
- repos satelite para extraccion o migracion.

## 2. Fuente de verdad recomendada

### Vision oficial
- `/home/yoni/labsemse/vision`

### Programa oficial
- `/home/yoni/labsemse/program`

### Implementacion tecnica canonica
- `/home/yoni/labsemse/project-manager-app`

## 3. Hallazgos importantes

### 3.1 project-manager-app dentro de labsemse
Ruta:
- `/home/yoni/labsemse/project-manager-app`

Estado observado:
- repositorio git real;
- rama `main`;
- ultimo commit visible: `feat: consolidate semse api and web surfaces`;
- monorepo con `apps/web`, `apps/api`, `apps/worker`;
- paquetes compartidos (`db`, `schemas`, `auth`, `agents`);
- documentacion de arquitectura, foundation y vision;
- CI, tests, smoke scripts y Prisma.

Decision:
- esta es la base tecnica principal de SEMSE.

### 3.2 project-manager-app en home
Ruta:
- `/home/yoni/labsemse/project-manager-app`

Estado observado:
- no es repositorio git;
- solo contiene `package.json` y `README.md`;
- `package.json` indica nombre `project-manager-app-local-wrapper`.

Decision:
- no es el core real;
- probablemente es wrapper, residuo local o punto de entrada auxiliar;
- no debe considerarse fuente de verdad.

### 3.3 semseproject/app
Ruta:
- `/home/yoni/Descargas/semseproject/app`

Rol probable:
- prototipo o acelerador frontend.

Aportes potenciales:
- componentes UI;
- patrones de dashboard;
- experiencia visual;
- integracion de frontend moderna.

Decision:
- extraer valor de producto/UI;
- no usar como repositorio principal.

### 3.4 semse-control-mvp
Ruta:
- `/home/yoni/Descargas/semse-control-mvp`

Rol probable:
- MVP vertical de operacion y control.

Aportes potenciales:
- worklog;
- evidencia;
- knowledge;
- units tracking;
- flujo de operacion de campo.

Decision:
- extraer ideas, modelos y pantallas utiles;
- no usar como base arquitectonica principal.

## 4. Arquitectura conceptual consolidada

SEMSE debe consolidarse en 4 capas:

### 4.1 SEMSE Jobs
Flujo comercial canonico:
- jobs;
- reservations;
- acceptance;
- contracts;
- milestones;
- evidence;
- escrow;
- releases;
- disputes;
- ratings.

### 4.2 SEMSE Ops
Operacion y supervision:
- audit;
- workers;
- alertas;
- runbooks;
- backoffice;
- monitoreo;
- SLAs;
- soporte operativo.

### 4.3 SEMSE Trust
Confianza y riesgo:
- trust score;
- reputation by behavior;
- antifraude;
- evidence score;
- dispute analytics;
- risk signals.

### 4.4 Prometeo
Evolucion futura institucional:
- identidad;
- wallets;
- treasury;
- proposals;
- voting;
- policy engine;
- coordinacion distribuida.

Regla:
- Prometeo orienta la arquitectura, pero no entra completo al MVP.

## 5. Clasificacion operativa de piezas

### Conservar como oficiales
- `/home/yoni/labsemse/vision`
- `/home/yoni/labsemse/program`
- `/home/yoni/labsemse/project-manager-app`

### Auditar para extraccion
- `/home/yoni/Descargas/semseproject/app`
- `/home/yoni/Descargas/semse-control-mvp`

### Tratar como secundario / no canonico
- `/home/yoni/labsemse/project-manager-app`

## 6. Riesgos actuales

- duplicacion de trabajo entre prototipos;
- confusion sobre el repo principal;
- mezcla de UI con dominio sin consolidacion previa;
- operacion de campo separada del flujo comercial;
- vision fuerte pero codigo distribuido en varias rutas;
- riesgo de seguir construyendo sobre piezas descargadas o no canonicas.

## 7. Decisiones recomendadas inmediatas

1. Declarar oficialmente que el codigo principal vive en:
   - `/home/yoni/labsemse/project-manager-app`
2. Declarar que `vision/` y `program/` gobiernan direccion y roadmap.
3. Tratar `Descargas/semseproject/app` y `Descargas/semse-control-mvp` como fuentes de migracion, no como hogares del producto.
4. Auditar que valor diferencial real existe en cada satelite.
5. Consolidar backlog de integracion antes de mover codigo.

## 8. Backlog de consolidacion recomendado

### Fase 0. Alineacion
- fijar repo canonico;
- documentar piezas satelite;
- definir criterios de migracion;
- definir criterios de archivo.

### Fase 1. Auditoria diferencial
- comparar modulos y pantallas entre el core y los satelites;
- listar activos rescatables;
- identificar duplicados y contradicciones.

### Fase 2. Dominio canonico
- cerrar entidades oficiales;
- cerrar estados y transiciones;
- separar claramente jobs, milestones, escrow, payments, disputes y audit.

### Fase 3. Integracion por modulos
- integrar frontend util;
- integrar worklog/evidence/knowledge si encajan con el dominio canonico;
- integrar trust signals;
- reforzar ops surfaces.

### Fase 4. Limpieza
- archivar duplicados;
- mover o congelar carpetas satelite;
- documentar donde vive cada cosa.

## 9. Siguiente trabajo recomendado

### Prioridad inmediata
1. auditar diferencialmente:
   - `project-manager-app` canonico;
   - `semseproject/app`;
   - `semse-control-mvp`.
2. producir matriz de extraccion por modulo.
3. convertir esa matriz en backlog ejecutable.

## 10. Nota sobre el workspace OpenClaw

Sigue pendiente configurar identidad git local del workspace para poder hacer commits aqui.
Faltan:
- `git user.name`
- `git user.email`

Sin eso, puedo seguir analizando, documentando y preparando el plan, pero no cerrar commits en este workspace todavia.
