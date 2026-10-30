---
type: decisions
feature: "Motor de costos unificado — Q2 auditoría de datos históricos"
spec: "docs/specs/api/cost-engine.spec.md"
version: "0.1"
status: "OPEN"
date: "2026-10-30"
---

# Q2 — Solicitud de auditoría de datos históricos para calibrar el motor de costos (borrador)

> **Estado: `OPEN`. Borrador para revisión. La consulta NO se ha ejecutado** (ni en producción ni en una copia), y su **sintaxis
> no está validada contra una base de datos real**. No autoriza ejecutar SQL en producción, cambiar precios, modificar impuestos
> ni fusionar el #1075. Complementa el expediente Q2 de `cost-engine.decisions.md`.
>
> Consulta: `docs/specs/api/cost-engine.q2-data-audit.sql`.

## 1. Qué se quiere saber

¿Cuántos proyectos de SEMSE tienen datos suficientes para **calibrar** los motores (comparar el estimado original con el costo real)?
GAO recomienda derivar la incertidumbre de datos históricos y comprobar que son aplicables (verificado en búsqueda web; ver expediente Q2).
Hoy no se sabe si existe volumen suficiente. Esta auditoría lo mide **sin leer datos personales**.

## 2. Responsables y validación

| Rol | Responsabilidad | Nombre |
|---|---|---|
| Dueño de la decisión | Autoriza ejecutar y acepta el informe | *[por asignar]* |
| Responsable de datos | Define "dato económico completo" y revisa resultados | *[por asignar]* |
| Seguridad y privacidad | Aprueba aislamiento, agregación y supresión de celdas | *[por asignar]* |
| DBA | Revisa el plan (`EXPLAIN`), rol de solo lectura, ventana y entorno | *[por asignar]* |
| Costos / finanzas | Interpreta las celdas de calibración con un especialista del oficio | *[por asignar]* |

## 3. Qué distingue la consulta (terminado ≠ datos económicos completos)

Cada intake se clasifica en escalones **acumulativos**. Cada escalón es un subconjunto del anterior:

| Escalón | Significado | Fuente en el esquema |
|---|---|---|
| `estimated` | Tiene estimado original usable (rango numérico en USD) | `ProjectIntake.generatedEstimateJson.totalRange` |
| `published` | Se publicó como trabajo | `ProjectIntake.publishedJobId` → `Job.id` (mismo `tenantId`, no borrado) |
| `finished` | **Terminado** | `Job.status = 'COMPLETED'` **o** `Project.status = 'COMPLETED'` |
| `finished_with_agreed_price` | Terminado con precio acordado | `Contract.termsJson.totalAmount` **o** `Bid.amount` con `status = 'ACCEPTED'` |
| `payment_evidence_only` | **Solo hay pagos liberados**, sin gasto ni horas aprobadas | `PaymentTxn.type = 'RELEASE'` y `status = 'SUCCEEDED'`, y ninguna evidencia de costo |
| `cost_evidence_loose` | Terminado con precio **y** algún costo real aprobado | `ProjectExpense` aprobada/reembolsada (no duplicada, USD) **o** `TimeEntry` aprobada con tarifa |
| `cost_evidence_strict` | Terminado con precio **y** evidencia de materiales **y** de mano de obra | gasto de materiales (USD) **y** (gasto de mano de obra **o** horas) |

**Un pago de escrow no es el costo real del trabajo:** es dinero liberado al profesional. Por eso `payment_evidence_only` se cuenta aparte
y **nunca** cuenta como evidencia de costo. Qué definición de "completo" se usa (`loose` o `strict`) la decide el responsable de datos.

También devuelve, por total, categoría, estado, trimestre y categoría × estado: región resuelta a un código de estado válido (o `UNRESOLVED`),
trimestre de creación del intake, y **diagnósticos de calidad**: estimados no usables, `publishedJobId` sin trabajo, contratos sin total,
terminados sin precio, registros de costo en moneda distinta de USD y regiones no resueltas.

Una sonda previa (Q0) lista **solo los nombres de clave** de `Contract.termsJson` y su frecuencia, para confirmar dónde vive el precio acordado antes de fiarse de los resultados.

## 4. Evidencia disponible (esquema real, `packages/db/prisma/schema.prisma`)

| Concepto | Dónde está | Notas |
|---|---|---|
| Estimado original | `ProjectIntake.generatedEstimateJson` | Incluye `totalRange`, `generatedAt`; **sin versión de motor ni de parámetros** |
| Oficio | `ProjectIntake.detectedCategory`; `Job.category`; `BuildOpsProject.trade` | La categoría del intake es la usada |
| Región | `ProjectIntake.city`, `Job.location` | **Texto libre**; el wizard no exige estado |
| Enlace intake → trabajo | `ProjectIntake.publishedJobId` | **Sin llave foránea declarada** |
| Terminado | `Job.status` (`COMPLETED`), `Project.status` | No existe fecha de finalización dedicada |
| Precio acordado | `Contract.termsJson` (JSON), `Bid.amount` aceptada | Estructura de `termsJson` por confirmar con Q0 |
| Pagos liberados | `PaymentEscrow` + `PaymentTxn` (`RELEASE`/`SUCCEEDED`) | Alcanzables solo vía `Job` |
| Costo real | `ProjectExpense` (categorías `materials`, `labor`, …), `TimeEntry` | Ver limitaciones §5 |
| Fecha | `ProjectIntake.createdAt` | Se usa el **trimestre de creación** |

## 5. Lo que todavía falta comprobar (limitaciones conocidas)

1. **Integridad del enlace** intake → trabajo: sin llave foránea, puede haber `publishedJobId` huérfanos (el diagnóstico `dq_published_job_not_found` los cuenta).
   Tampoco se verifica si **dos intakes apuntan al mismo trabajo** (se contaría dos veces): requiere una comprobación adicional de solo conteo.
2. **Fecha de finalización:** no existe; el informe usa el trimestre de creación del intake como proxy.
3. **Estructura de `Contract.termsJson`:** se asume `totalAmount` en el primer nivel; Q0 debe confirmarlo.
4. **`TimeEntry.currency` tiene por defecto `'MXN'`** y `hourlyRate` no distingue tarifa pagada de tarifa facturada: las horas son evidencia **débil** de costo; los registros no USD se excluyen y se cuentan.
5. **`ProjectExpense`:** las categorías son texto con valores sugeridos en un comentario del esquema; un gasto puede pertenecer a un proyecto de varios oficios y no coincidir con el alcance del estimado.
6. **Cambios de alcance:** `ChangeOrderCandidate` guarda solo rangos estimados, no importes aprobados reales; **no se usa**. No sé dónde se registran las órdenes de cambio aprobadas con su monto final **[PENDIENTE]**.
7. **Región:** se obtiene de un texto libre con un patrón "…, ST" validado contra los 50 estados y DC; ciudades sin estado quedan `UNRESOLVED`.
8. **Sintaxis y rendimiento:** no se ha ejecutado `EXPLAIN` ni la consulta en ninguna base.

## 6. Lo que este informe NO demostrará

Contar proyectos no demuestra que los datos sean fiables, comparables ni suficientes para calibrar. El tamaño mínimo de muestra por oficio, región y
complejidad, y la métrica de error, los define un responsable de costos con revisión estadística (**A DEFINIR**).

## 7. Revisión previa a cualquier ejecución

### Autorización
- [ ] Dueño de la decisión autoriza por escrito (qué entorno, qué modo, qué fecha).
- [ ] Seguridad/privacidad y responsable de datos aprueban el alcance y el destino de los resultados.

### Entorno y rendimiento
- [ ] Ejecutar solo sobre **una copia restaurada o una réplica de solo lectura**, no sobre el primario (la infraestructura de simulacros de restauración de Postgres puede servir si el DBA la autoriza).
- [ ] `EXPLAIN` primero. Puntos de atención: `ProjectIntake` se recorre completa; `ProjectExpense` no tiene índice por `jobId`, y la condición `projectId = … OR jobId = …` puede degradar el plan; `TimeEntry` sí tiene índice `(tenantId, jobId)`.
- [ ] Los `statement_timeout` (120 s), `lock_timeout` (2 s) e `idle_in_transaction_session_timeout` (120 s) son **propuestas** que fija el DBA.
- [ ] Transacción `READ ONLY` y un rol con `SELECT` solo sobre las tablas listadas.

### Aislamiento entre organizaciones
- [ ] Primera ejecución **por organización** (`tenant_id` explícito). La ejecución global (`tenant_id` vacío) solo con autorización de plataforma.
- [ ] Toda unión exige el mismo `tenantId`; `Contract`, `PaymentEscrow` y `PaymentTxn` no tienen `tenantId` propio y se alcanzan únicamente a través de `Job`.
- [ ] Verificar con datos de prueba que ninguna fila de otra organización entra en un conteo.

### Protección de datos personales
- [ ] La salida son **conteos agregados**: sin identificadores, nombres, correos, direcciones, descripciones ni importes individuales.
- [ ] Supresión de celdas con menos de `min_cell` casos (**propuesta: 5**, fijada por privacidad). **No hay supresión complementaria**: restando totales se podrían deducir celdas suprimidas; revisar antes de compartir tablas por categoría × estado.
- [ ] Los resultados no se pegan en chats ni tickets públicos; se guardan con acceso restringido y retención definida.
- [ ] Se registra quién ejecutó, cuándo y contra qué entorno.

## 8. Riesgos

| Riesgo | Mitigación |
|---|---|
| Carga sobre producción | Copia/réplica, `EXPLAIN`, timeouts, ventana fuera de hora pico |
| Fuga entre organizaciones | Ejecución por organización, uniones con `tenantId`, prueba con datos sintéticos |
| Reidentificación por celdas pequeñas | Supresión mínima y revisión de privacidad antes de compartir |
| Conclusiones erróneas (p. ej. tratar pagos como costos) | Escalón `payment_evidence_only` separado y definición aprobada de "completo" |
| Sesgo de selección (solo trabajos publicados y terminados) | Reportarlo; no extrapolar a todo el mercado sin análisis |

## 9. Criterio para cerrar esta decisión

1. Dueño, datos, seguridad/privacidad y DBA aprobaron por escrito la ejecución, el entorno y el tratamiento de resultados.
2. Se validó la sintaxis y el plan (`EXPLAIN`) en una copia, y Q0 confirmó la estructura de `termsJson`.
3. Se ejecutó y el informe se entregó al responsable de datos y a costos, con los diagnósticos de calidad.
4. El responsable de datos fijó la definición de "dato económico completo" (`loose` o `strict`) y costos fijó el tamaño mínimo de muestra y la métrica.
5. Se decidió, con ese informe, si hay datos para calibrar o si hay que **empezar a capturar costos reales** (plan de captura) antes de hablar de confianza "calibrada".

**Estado: `OPEN`.** El owner decide cuándo pasa a `DECIDIDA`.
