---
type: decisions
feature: "Motor de costos unificado — Q11 nota para revisión jurídica"
spec: "docs/specs/api/cost-engine.spec.md"
version: "0.1"
status: "OPEN"
date: "2026-10-30"
---

# Nota para revisión jurídica — Procedencia y derechos de uso de multiplicadores atribuidos a RSMeans (borrador)

> **Estado: `OPEN`. Borrador para revisión interna antes de enviarlo a Legal.** No es asesoría jurídica ni una conclusión sobre
> infracción. No autoriza retirar valores, cambiar precios en producción, modificar impuestos ni fusionar el #1075.
> **Mientras no exista el dictamen, los valores no deben considerarse comercialmente validados.**

**Para:** Legal / asesor jurídico *[por asignar]* · **De:** *[solicitante, por asignar]* · **Fecha:** 2026-10-30
**Asunto:** ¿Puede SEMSE usar, transformar, almacenar y redistribuir comercialmente en un producto SaaS la tabla de multiplicadores de materiales por estado
atribuida a "RSMeans 2023", y qué hacer si los derechos son insuficientes?

## 1. Resumen

Un archivo del backend de SEMSE contiene una tabla de multiplicadores de costo de material por estado de EE. UU. con un comentario que la atribuye a
**RSMeans 2023 City Cost Index**. No encontramos en el repositorio ningún archivo de datos, licencia ni registro que explique su origen.
Se necesita saber (a) si esos valores son o derivan de datos protegidos, (b) si SEMSE puede usarlos comercialmente y (c) cómo corregir la situación si no.

## 2. Hechos verificados en el repositorio

| Hecho | Dónde |
|---|---|
| El comentario dice: *"RSMeans-based static material cost multipliers by state (vs. national avg = 1.00). Source: RSMeans 2023 City Cost Index — state-level approximations."* | `apps/api/src/modules/pricing/location-cost.service.ts`, líneas 8–9 |
| La tabla se llama `STATIC_MATERIAL_MULTIPLIERS`: un valor por estado, con dos decimales, en el rango 0.84–1.35 | mismo archivo, desde la línea 10 |
| Un comentario de tipo describe `LocationMultipliers` como *"derived from BLS OEWS + RSMeans state indices"* | `packages/tools/src/core/types.ts`, línea 53 |
| La tabla alimenta `materialMultiplier` (línea 167) y se **guarda** en la tabla `LocationCostIndex` con `dataSource` `"oews+static"` | `location-cost.service.ts`; `schema.prisma` (`LocationCostIndex`); migración `20260521100000_labor_rate_location_cost` |
| Esos multiplicadores se **aplican a estimados** que usan ProTools y la inteligencia de presupuesto | `semse-agents/protools.agent.ts` (línea 194), `intelligence/budget-intelligence.service.ts` (línea 185) |
| La tabla se introdujo en **un solo commit**, `1543468a`, del **2026-05-21**. El mensaje dice: *"ZIP → estado → multipliers RSMeans (material) + OEWS (labor)"*; el commit lleva un trailer de **coautoría de un asistente de IA** | `git log -S"RSMeans"` |
| No encontramos ningún archivo de datos, licencia ni registro de procedencia de RSMeans en el repositorio | búsqueda de texto del término "RSMeans" en `docs`, `apps` y `packages` (solo aparece en los archivos de esta tabla y en estos documentos); no se revisaron otros nombres de archivo ni sistemas externos |
| Los propios documentos de planificación tratan a RSMeans como una **fuente de pago futura con la "Decisión de licencia" pendiente** (módulo 3.3.A) y dejan la "calibración paga con RSMeans/NECA/PHCC" **fuera de alcance** de la fase de costos regionales | `docs/PROTOOLS_MASTER_PLAN.md` (líneas 184–188); `docs/specs/tools/fase-1/m1.2-regional-costs.spec.md` (línea 41); `docs/specs/tools/fase-3/m3.3-labor-calibration.spec.md` (línea 35) |

## 3. Atribución en un comentario ≠ evidencia de datos copiados

Lo que **sabemos**: el código afirma, en un comentario, que los valores provienen de RSMeans. Lo que **no sabemos**: de dónde salieron realmente los números.

| Hipótesis | Qué la sostendría | Qué la debilitaría |
|---|---|---|
| **H1** Los valores se copiaron o derivaron de una publicación o conjunto de datos de RSMeans | Acceso de SEMSE a una suscripción o libro; coincidencia con valores publicados | Que SEMSE nunca haya tenido acceso (los documentos internos sugieren que la licencia estaba pendiente) |
| **H2** Son **aproximaciones propias o generadas**, sin acceso al dataset, con una **atribución nominal imprecisa** | Origen en un commit asistido por IA; valores redondeados a dos decimales; ausencia de datos fuente; licencia "pendiente" | Evidencia de que alguien consultó RSMeans al crearlos |
| **H3** Provienen de otra fuente pública y están **mal atribuidos** | Coincidencia con índices públicos | Falta de documentación |

**No se puede concluir cuál es cierta con la evidencia disponible.** Incluso en H2 o H3 hay un asunto propio: una atribución a un tercero que puede ser inexacta
(y que además hace dudar de la exactitud de los valores). **No se debe obtener datos de RSMeans para compararlos sin indicación de Legal.**

## 4. Restricciones contractuales relevantes (extractos; **Legal debe leer el contrato aplicable**)

*Hallado en una búsqueda web de esta sesión; no se leyeron los textos completos.*

- Los avisos de las publicaciones de Gordian indican que los datos **no pueden integrarse en ningún software, programa ni base de datos** y se licencian para uso interno limitado.
- El addendum de sublicencia de Trimble (RSMeans dentro de software de Trimble) limita el uso a la estimación habitual del licenciatario y, entre otras restricciones, **prohíbe**
  almacenar los datos en una base de datos consultable por terceros y usarlos como componente o base para fijar precios de productos que el licenciatario vende.
- Gordian comercializa la integración (API o archivo plano) bajo **términos comerciales separados**.
- El owner cita la sección 2.2 del "Addendum 1"; **no pude confirmar ese número de sección** en esta sesión.
- **Pregunta previa:** ¿SEMSE tiene o tuvo alguna licencia de RSMeans o de Gordian/Trimble? ¿Bajo qué contrato, entidad y fecha?

## 5. Preguntas concretas para Legal

1. ¿La tabla `STATIC_MATERIAL_MULTIPLIERS` constituye o deriva de datos protegidos de RSMeans? ¿Qué evidencia adicional necesitaría para determinarlo?
2. En un producto SaaS, ¿puede SEMSE **utilizar**, **transformar** (p. ej. combinarlos con OEWS), **almacenar** (`LocationCostIndex`) y **redistribuir comercialmente** (mostrarlos en estimados a clientes y profesionales) esos valores? Con qué condiciones.
3. ¿La atribución a "RSMeans 2023" en el código, si no refleja el origen real, genera por sí misma un riesgo (atribución indebida o declaraciones inexactas)?
4. **Exposición ya ocurrida:** los valores están en el repositorio desde el 2026-05-21 y se guardan en una base de datos de producción. ¿Qué implica para el periodo transcurrido? *(La fecha de primera exposición en producción y qué clientes vieron estimados con ellos están **por confirmar**.)*
5. Si los derechos son **insuficientes**: ¿qué pasos obligatorios hay (cese de uso, retiro del repositorio y de la base de datos, notificación, conservación de evidencia) y en qué orden?
6. ¿Qué **alternativas** son jurídicamente seguras (ver §7) y qué documentación de procedencia debe exigir SEMSE a cada una?

## 6. Evidencia a adjuntar y a recopilar

- **Ya disponible:** extracto de `location-cost.service.ts` (líneas 8–22 y 167), línea 53 de `types.ts`, historial de `git` del commit `1543468a`, migración `20260521100000`, modelo `LocationCostIndex`, documentos de planificación (§2).
- **Por recopilar (responsable de datos / ingeniería):**
  - quién creó la tabla y con qué proceso (entrevista breve; instrucciones usadas si fue asistida por IA);
  - si existe alguna suscripción, libro o descarga de RSMeans/Gordian/Trimble en SEMSE;
  - desde cuándo se despliega a producción y qué estimados la usaron (consulta de solo lectura, con autorización);
  - cómo se conserva la evidencia sin borrar el historial.

## 7. Alternativas a evaluar si los derechos son insuficientes (ninguna decidida)

| Alternativa | Idea | Qué verificar |
|---|---|---|
| Datos públicos autorizados | BLS (OEWS para salarios, PPI para variación de precios) y otras estadísticas públicas de diferencias regionales de precios *(p. ej. paridades regionales de precios; **no verificado en esta sesión**)* | Términos de uso, metodología, vigencia |
| Precios observados propios | Cotizaciones y gastos reales de la red SEMSE con proveedor, unidad, ubicación y fecha | Calidad, sesgo, volumen, privacidad |
| Licencia comercial con derechos de integración | Acuerdo con el proveedor que permita almacenar y redistribuir en SaaS | Costo, alcance, vigencia, auditoría |
| Neutralizar el ajuste regional de material (factor 1.0) hasta resolver | Dejar de aplicar la tabla | Impacto en los estimados; requiere **autorización de cambio de precios** aparte |

## 8. Medidas provisionales propuestas (NO ejecutadas; requieren autorización del owner)

- Etiquetar internamente los valores como **"no validados comercialmente"**.
- Tras el dictamen, decidir si se retira o sustituye la tabla; **cualquier cambio que altere precios mostrados es una autorización distinta**.
- No presentar los valores como validados ni citar a RSMeans hacia clientes mientras tanto.
- Conservar el historial de `git` y la base de datos tal como están hasta que Legal indique lo contrario.

## 9. Riesgos

| Riesgo | Observación |
|---|---|
| Uso de datos con licencia restringida | No confirmado; depende del origen real |
| Atribución inexacta a un tercero | Posible incluso si los números no vienen de RSMeans |
| Estimados engañosos | Los valores no están validados; afectan precios mostrados |
| Retirada abrupta | Cambia estimados; exige coordinación y autorización |

## 10. Responsable de validación y criterio para cerrar

- **Responsables:** Legal (dictamen), responsable de datos (hechos de §6), dueño de la decisión (autoriza acciones).
- **La decisión se cierra cuando:**
  1. Legal emite un dictamen escrito que responde las preguntas 1–6;
  2. se completó la evidencia de §6 o Legal confirmó que no hace falta;
  3. el owner decidió la acción (mantener con licencia, sustituir o retirar) y la autorizó expresamente;
  4. cada fuente económica del motor tiene registro de procedencia y permiso de uso (criterio de aceptación de Q11 en `cost-engine.decisions.md`).

**Estado: `OPEN`.** El owner decide cuándo pasa a `DECIDIDA`.
