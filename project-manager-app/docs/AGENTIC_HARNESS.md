# AGENTIC HARNESS — SEMSEproject ProTools Loop
**Versión:** 1.0
**Fecha:** 2026-05-20
**Estado:** ACTIVE

> Este documento define cómo opera un agente de IA en modo loop dentro de SEMSEproject.
> Es el "manual de vuelo" del agente. Si el agente puede leer un solo documento, que sea este.

---

## ¿Qué es el Harness Agentico?

El harness es el sistema que permite a un agente de IA:
1. **Arrancar** sin contexto previo y saber exactamente qué hacer
2. **Continuar** desde donde se quedó una sesión anterior
3. **Ejecutar** cada bloque de trabajo siguiendo el flujo SDD
4. **Registrar** el progreso para que el siguiente agente lo retome
5. **No perderse** aunque el contexto se comprima o la sesión se reinicie

---

## Protocolo de Arranque (Inicio de Sesión)

Al inicio de CADA sesión el agente ejecuta este checklist en orden:

```
[ ] 1. Leer .specify/memory/constitution.md         ← principios inamovibles
[ ] 2. Leer docs/SPEC_INDEX.md                       ← qué specs existen
[ ] 3. Leer docs/PROTOOLS_MASTER_PLAN.md             ← estado del plan completo
[ ] 4. Identificar el primer bloque en estado PENDING ← próxima tarea
[ ] 5. Leer el spec del módulo correspondiente        ← contexto técnico
[ ] 6. Verificar dependencias del bloque              ← ¿hay bloqueadores?
[ ] 7. Declarar en texto: "Iniciando bloque [ID]: [nombre]"
```

---

## Cómo Identificar la Próxima Tarea

En `docs/PROTOOLS_MASTER_PLAN.md`:

1. Buscar la **primera fase** con bloques en estado `PENDING`
2. Dentro de esa fase, buscar el **primer módulo** con `PENDING`
3. Dentro de ese módulo, buscar el **primer bloque** con `PENDING`
4. Verificar que sus dependencias estén en `DONE`
5. Si hay dependencias pendientes → buscar el siguiente bloque sin dependencias bloqueadas

**Regla:** Nunca empezar un bloque cuyas dependencias estén en `PENDING` o `BLOCKED`.

---

## Flujo de Ejecución por Bloque (SDD Obligatorio)

Para CADA bloque, seguir este flujo sin saltarse pasos:

### Paso 1 — SPECIFY (crear o verificar spec)
```
Si existe docs/specs/tools/fase-X/mX.Y-nombre.spec.md:
  → Leerlo completo
  → Verificar que cubre el bloque actual
Sino:
  → Crear el spec usando template .specify/templates/overrides/semse-spec.md
  → El spec debe incluir: objetivo, inputs, outputs, FSM transitions, audit events, tests requeridos
  → Guardar en docs/specs/tools/fase-X/mX.Y-nombre.spec.md
  → Actualizar SPEC_INDEX.md con el nuevo spec
```

### Paso 2 — PLAN (plan técnico)
```
Crear docs/specs/tools/fase-X/mX.Y-nombre.plan.md con:
  - Archivos a crear o modificar
  - Cambios en schema Prisma (si aplica)
  - Nuevas dependencias (packages npm a instalar)
  - Orden de implementación
  - Riesgos y mitigaciones
```

### Paso 3 — TASKS (lista de tareas atómicas)
```
Crear docs/specs/tools/fase-X/mX.Y-nombre.tasks.md con:
  - Tareas ordenadas (cada una ~30-60 min de trabajo)
  - Criterio de completitud por tarea
  - Tests a escribir
```

### Paso 4 — IMPLEMENT (código)
```
Ejecutar las tareas en orden:
  1. Escribir tests primero (Artículo II constitución)
  2. Implementar el código
  3. Verificar: npm run verify:workspace (typecheck + test + build)
  4. Confirmar que tests pasan
```

### Paso 5 — CHECKLIST (verificación pre-commit)
```
Verificar antes de marcar DONE:
  [ ] Tests escritos y pasando
  [ ] AuditLog emitido para cambios de estado (Artículo V)
  [ ] RBAC declarado en endpoints nuevos (Artículo VI)
  [ ] tenantId en nuevos modelos Prisma (Artículo VII)
  [ ] privacyCritical marcado si aplica (Artículo VIII)
  [ ] Research loop externo ejecutado: mínimo 3 búsquedas independientes
  [ ] Mejoras externas aplicadas, descartadas o enviadas a backlog con justificación
  [ ] SPEC_INDEX.md actualizado
  [ ] PROTOOLS_MASTER_PLAN.md actualizado (PENDING → DONE)
  [ ] Reporte creado en docs/reportes/YYYY-MM-DD-[bloque-id].md
```

### Paso 6 — COMMIT
```
git add [archivos específicos, nunca git add .]
git commit -m "feat([módulo]): [descripción concisa] [ID de bloque]"
```

---

## Formato de Reporte por Bloque

Crear `docs/reportes/YYYY-MM-DD-[ID].md` al completar cada bloque:

```markdown
# Reporte: [Bloque ID] — [Nombre del Bloque]
**Fecha:** YYYY-MM-DD
**Agente:** Claude (claude-sonnet-4-6)
**Estado final:** DONE

## Qué se hizo
- [lista de cambios reales]

## Archivos modificados
- `ruta/archivo.ts` — descripción del cambio

## Tests añadidos
- `ruta/archivo.test.ts` — descripción

## Decisiones tomadas
- [decisión y justificación]

## Investigación externa de mejora

### Búsquedas ejecutadas
1. `[consulta exacta]` — fuente(s): [link]
2. `[consulta exacta]` — fuente(s): [link]
3. `[consulta exacta]` — fuente(s): [link]

### Ideas detectadas
- [idea] — [fuente] — [impacto esperado]

### Decisiones
- Aplicado ahora: [cambio aplicado y motivo]
- Backlog: [mejora diferida y motivo]
- Descartado: [idea descartada y motivo]

## Problemas encontrados
- [problema y cómo se resolvió]

## Próximo bloque recomendado
- [ID]: [nombre]
```

## Research Loop Externo Obligatorio

Cada vez que un módulo, PR, bloque SDD o corte de código quede listo, el agente debe
hacer una pausa de mejora antes de marcarlo como DONE.

El ciclo mínimo es:

```
1. Buscar en internet al menos 3 veces con consultas distintas.
2. Revisar fuentes primarias cuando existan: documentación oficial, specs, papers,
   runbooks de proveedores o guías del framework.
3. Comparar lo encontrado contra el código/spec actual.
4. Aplicar mejoras pequeñas si están dentro del alcance.
5. Crear backlog si la mejora es válida pero excede el PR.
6. Descartar explícitamente lo que no aplica.
7. Registrar todo en el reporte de sesión/bloque.
```

Tipos de búsqueda recomendados:

```
Consulta 1 — práctica técnica del módulo.
Consulta 2 — seguridad, permisos, datos o privacidad.
Consulta 3 — testing, CI/CD, observabilidad, UX o deploy.
```

Ejemplo:

```
Módulo: EvidenceOps
1. "evidence management audit trail best practices software"
2. "file upload security best practices OWASP"
3. "API evidence attachment permission model multi tenant"
```

El agente no debe convertir hallazgos externos en scope creep. Si una mejora supera
el alcance del bloque, se documenta en backlog y no se implementa hasta que exista
spec/plan/tasks.

---

## Cómo Manejar Bloqueos

Si un bloque no puede completarse:

```
1. Cambiar estado a BLOCKED en PROTOOLS_MASTER_PLAN.md
2. Documentar en Notas: motivo del bloqueo
3. Buscar el siguiente bloque SIN dependencias bloqueadas
4. Si no hay bloques desbloqueados → reportar al usuario con lista de bloqueos
```

**Bloqueos comunes y su resolución:**
| Bloqueo | Acción |
|---|---|
| API requiere cuenta/key | Documentar en bloque, avanzar al siguiente, reportar al usuario |
| Migración Prisma requiere revisión | Crear spec de migración, esperar aprobación manual |
| Spec incompleto o ambiguo | Completar spec antes de implementar, no adivinar |
| Test falla por razón externa | Documentar, no skipear, escalar |

---

## Variables de Estado del Harness

El agente mantiene estas variables en su contexto:

```
CURRENT_PHASE:    [1-5]
CURRENT_MODULE:   [e.g., 1.1]
CURRENT_BLOCK:    [e.g., 1.1.A]
BLOCK_STATUS:     [PENDING|IN_PROGRESS|DONE|BLOCKED]
SESSION_START:    [timestamp]
BLOCKS_COMPLETED: [count in this session]
```

---

## Reglas de Autonomía

### El agente PUEDE hacer sin pedir permiso:
- Crear archivos de spec, plan y tasks
- Crear archivos de código en `packages/tools/`
- Escribir tests
- Actualizar `PROTOOLS_MASTER_PLAN.md`
- Crear reportes
- Instalar packages npm de la lista aprobada (ver abajo)

### El agente DEBE pedir confirmación antes de:
- Modificar `packages/db/prisma/schema.prisma` (migración Prisma)
- Añadir credenciales o API keys al `.env`
- Modificar `apps/api/src/app.module.ts` (inyección de módulos)
- Hacer push al repositorio
- Instalar packages npm fuera de la lista aprobada
- Cualquier acción en infraestructura (Railway, AWS, Stripe dashboard)

### Packages npm aprobados para instalar sin confirmación:
```
@nestjs/*          (módulos NestJS oficiales)
@prisma/client     (cliente Prisma)
axios              (HTTP client)
zod                (validación)
ioredis            (Redis)
bullmq             (queues)
stripe             (Stripe SDK)
plaid              (Plaid SDK)
@hellosign/sdk     (HelloSign)
lob-typescript     (Lob.com)
```

---

## Modo de Trabajo en Bucle (/loop)

Cuando el usuario activa el modo loop, el agente:

1. Ejecuta el Protocolo de Arranque
2. Identifica el próximo bloque PENDING sin dependencias bloqueadas
3. Ejecuta el Flujo SDD completo para ese bloque
4. Actualiza PROTOOLS_MASTER_PLAN.md
5. Crea el reporte
6. Repite desde el paso 2

El bucle se detiene cuando:
- Todos los bloques de la fase activa están en DONE o BLOCKED
- El usuario interrumpe
- Se encuentra un bloqueo que requiere acción humana

---

## Contexto Técnico del Sistema

### Arquitectura de ProTools en el Monorepo
```
packages/tools/src/
├── core/                    ← motores base (NO modificar estructura)
│   ├── cost-engine.ts       ← MODIFICAR: añadir multiplicador regional
│   ├── labor-engine.ts      ← MODIFICAR: calibrar con NECA/PHCC
│   ├── material-engine.ts   ← MODIFICAR: lookup dinámico de precios
│   ├── validation-engine.ts ← NO modificar (mensajes en español)
│   ├── risk-engine.ts       ← NO modificar estructura
│   ├── milestone-engine.ts  ← NO modificar
│   ├── evidence-engine.ts   ← NO modificar
│   ├── export-engine.ts     ← MODIFICAR: export bundle PDF
│   ├── extended-metrics.ts  ← MODIFICAR: añadir a más trades
│   └── types.ts             ← MODIFICAR: añadir zipCode, nuevos campos
├── business/
│   ├── quote-engine.ts      ← NO modificar (contingencia por riesgo OK)
│   ├── escrow-engine.ts     ← MODIFICAR: conectar con Stripe
│   ├── milestone-builder.ts ← NO modificar
│   ├── evidence-builder.ts  ← NO modificar
│   ├── change-order-engine.ts ← MODIFICAR: gate de firma digital
│   └── dispute-risk-engine.ts ← NO modificar
└── trades/                  ← 25 motores (ver estado en Módulo 3.2)
```

### Nuevo Módulo a Crear: packages/integrations/
```
packages/integrations/src/
├── pricing/
│   ├── bls-ppi.client.ts    ← cliente BLS PPI API
│   ├── estimation-pro.client.ts ← cliente EstimationPro API
│   ├── fred.client.ts       ← cliente FRED API
│   └── pricing.cache.ts     ← capa de caché en Redis
├── regional/
│   ├── bls-oews.client.ts   ← cliente BLS OEWS (salarios)
│   └── regional.resolver.ts ← resolver de multiplicadores
├── payments/
│   ├── stripe.client.ts     ← Stripe Connect client
│   └── plaid.client.ts      ← Plaid ACH verification
├── legal/
│   ├── liengrid.client.ts   ← LienGrid API client
│   ├── lob.client.ts        ← Lob.com certified mail
│   └── hellosign.client.ts  ← HelloSign e-signature
└── weather/
    └── tomorrow-io.client.ts ← Tomorrow.io weather alerts
```

### Nuevos Modelos Prisma a Añadir (en orden)
```
Fase 1:
  MaterialPriceSnapshot   ← precios de materiales en caché
  RegionalCostIndex       ← multiplicadores por zip/metro
  StripeAccount           ← cuenta Stripe Connect del contratista
  PlaidAccount            ← cuenta bancaria verificada

Fase 2:
  LienCalendar            ← deadlines de lien por proyecto
  LienNotice              ← notices enviados
  DailyLog                ← registro diario de campo
  WeatherAlert            ← alertas de clima por proyecto

Fase 4:
  PermitRecord            ← permisos del proyecto (OpenGov)
  QuickBooksSync          ← estado de sync contable
```

---

## Señales de Éxito por Bloque

Un bloque está DONE cuando:
1. El código compila sin errores TypeScript (`tsc --noEmit`)
2. Los tests pasan (`npm test`)
3. El spec está marcado APPROVED en SPEC_INDEX.md
4. El reporte está creado en `docs/reportes/`
5. PROTOOLS_MASTER_PLAN.md muestra el bloque en DONE
6. El commit está hecho con el mensaje correcto

---

## Contacto y Escalación

Si el agente se bloquea y no puede avanzar:
- Crear archivo `docs/reportes/BLOQUEADO-[fecha]-[bloque].md`
- Documentar exactamente qué se necesita del humano
- Listar los siguientes 3 bloques que SÍ puede ejecutar mientras el bloqueo se resuelve
