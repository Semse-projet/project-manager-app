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
Hoy no se sabe si existe volumen suficiente. Esta auditoría **no devuelve datos personales**, pero procesa registros individuales y financieros en origen. Requiere privilegios limitados y revisión de privacidad.

## 2. Responsables y validación

| Rol | Responsabilidad | Nombre |
|---|---|---|
| Dueño de la decisión y solicitante | Autoriza ejecutar y acepta el informe | `@Samuelcastella` (administrador de la organización y del repositorio en GitHub) |
| Responsable de datos | Define "dato económico completo" y revisa resultados | *[nombre por indicar]* |
| Seguridad y privacidad | Aprueba aislamiento, agregación y supresión de celdas | *[nombre por indicar]* |
| DBA | Revisa el plan (`EXPLAIN`), rol de solo lectura, ventana y entorno | *[nombre por indicar]* |
| Costos / finanzas | Interpreta las celdas de calibración con un especialista del oficio | *[nombre por indicar]* |

> Solo consta en el repositorio la cuenta del dueño (GitHub: administrador de la organización). **Los demás nombres no aparecen en ningún sistema que yo pueda consultar** y no se han supuesto: el owner debe indicarlos antes de enviar el borrador. Una persona puede cubrir más de un rol, salvo que quien **ejecuta** la consulta no debería ser también quien **aprueba** su aislamiento y privacidad.

## 3. Qué distingue la consulta (terminado ≠ datos económicos completos)

Cada intake se clasifica en escalones **acumulativos**. Los escalones de progresión son acumulativos; `payment_evidence_only` es una métrica lateral, no un escalón sucesivo:

| Escalón | Significado | Fuente en el esquema |
|---|---|---|
| `estimated` | Tiene estimado original usable (rango numérico en USD) | `ProjectIntake.generatedEstimateJson.totalRange` |
| `published` | Se publicó como trabajo | `ProjectIntake.publishedJobId` → `Job.id` (mismo `tenantId`, no borrado) |
| `finished` | **Terminado** | `Job.status = 'COMPLETED'` **o** `Project.status = 'COMPLETED'` |
| `finished_with_agreed_price` | Terminado con precio acordado | `Contract.termsJson.totalAmount` **o** `Bid.amount` con `status = 'ACCEPTED'` |
| `payment_evidence_only` | **Solo hay pagos liberados**, sin gasto ni horas aprobadas | `PaymentTxn.type = 'RELEASE'` y `status = 'SUCCEEDED'`, y ninguna evidencia de costo |
| `cost_evidence_loose` | Terminado con precio **y** al menos un gasto aprobado (cobertura parcial, no costo completo) | `ProjectExpense` aprobada/reembolsada (no duplicada, USD); `TimeEntry` es evidencia operativa separada |
| `cost_evidence_strict` | Terminado con precio **y** gastos registrados de materiales y mano de obra; no acredita la integridad del costo total | `ProjectExpense` aprobada (USD) de materiales **y** mano de obra, sin usar horas como importe pagado |

**Un pago de escrow no es el costo real del trabajo:** es dinero liberado al profesional. Por eso `payment_evidence_only` se cuenta aparte
y **nunca** cuenta como evidencia de costo. Ningún escalón acredita por sí solo costos finales completos. El responsable de datos y costos deberá definir el criterio adicional de integridad y conciliación.

Por defecto devuelve **solo totales por tenant**. La opción `detail_level=detail` agrega categoría, estado, trimestre y categoría × estado, pero es exclusivamente para revisión interna restringida y no autoriza publicación. La región se reduce a un código válido (o `UNRESOLVED`),
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
2. **Fecha de finalización:** no existe en estos modelos; la agrupación por trimestre de creación del intake no equivale al trimestre de finalización.
3. **Estructura de `Contract.termsJson`:** se asume `totalAmount` en el primer nivel; Q0 debe confirmarlo.
4. **`TimeEntry.currency` tiene por defecto `'MXN'`** y `hourlyRate` no distingue tarifa pagada de tarifa facturada. Además, la entrada puede ser personal o estar solo `completed` (no necesariamente aprobada). Por eso la consulta las trata como evidencia operativa auxiliar y no como costo real en `loose` ni `strict`.
5. **`ProjectExpense`:** las categorías son texto con valores sugeridos en un comentario del esquema; un gasto puede pertenecer a un proyecto de varios oficios y no coincidir con el alcance del estimado.
6. **Cambios de alcance:** `ChangeOrderCandidate` guarda solo rangos estimados, no importes aprobados reales; **no se usa**. No sé dónde se registran las órdenes de cambio aprobadas con su monto final **[PENDIENTE]**.
7. **Región:** se obtiene de un texto libre con un patrón "…, ST" validado contra los 50 estados y DC; ciudades sin estado quedan `UNRESOLVED`.
8. **Sintaxis y rendimiento:** no se ha ejecutado `EXPLAIN` ni la consulta en ninguna base.
9. **Separación organizacional:** `ProjectIntake` no tiene `orgId`; un `tenantId` puede contener varias organizaciones. La consulta mide un tenant, no una empresa. El análisis por organización requiere diseñar una cohorte derivada de Job/Project y no puede incluir sin más los intakes previos a publicación.
10. **Reconstrucción de celdas:** la supresión primaria por métrica no impide inferencias por resta entre escalones y agregados. Los resultados no están autorizados para publicación.

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
- [ ] Primera ejecución **por tenant** (`tenant_id` explícito y no vacío). El SQL no admite lectura global por `tenant_id=''`.
- [ ] Antes de solicitar desglose por organización: definir `orgId`, perspectiva (cliente/contratista) y vínculo de los intakes no publicados, que no tienen `orgId`; revisar permisos organizacionales y membresías activas.
- [ ] Toda unión exige el mismo `tenantId`; `Contract`, `PaymentEscrow` y `PaymentTxn` no tienen `tenantId` propio y se alcanzan únicamente a través de `Job`.
- [ ] Verificar con datos sintéticos ausencia de cruces entre tenants; la prueba de aislamiento entre organizaciones requiere un diseño adicional.

### Protección de datos personales
- [ ] La salida son **conteos agregados**: sin identificadores, nombres, correos, direcciones, descripciones ni importes individuales.
- [ ] Supresión primaria de filas y métricas con menos de `min_cell` casos (**propuesta: 5**, que debe fijar privacidad). **No existe supresión complementaria**: pueden inferirse cifras mediante diferencias entre escalones, totales y subgrupos. Ninguna salida está autorizada para difusión.
- [ ] Primera ejecución con `detail_level=summary`; `detail_level=detail` requiere autorización específica de seguridad/privacidad, incluso dentro del equipo.
- [ ] Los resultados no se pegan en chats ni tickets públicos; se guardan con acceso restringido y retención definida.
- [ ] Se registra quién ejecutó, cuándo y contra qué entorno.

## 8. Riesgos

| Riesgo | Mitigación |
|---|---|
| Carga sobre producción | Copia/réplica, `EXPLAIN`, timeouts, ventana fuera de hora pico |
| Confusión tenant/organización | Esta versión solo permite ámbito tenant explícito. Para resultados de una Org hace falta una cohorte y autorización específicas |
| Reidentificación por celdas pequeñas | Supresión mínima y revisión de privacidad antes de compartir |
| Conclusiones erróneas (p. ej. tratar pagos como costos) | Escalón `payment_evidence_only` separado y definición aprobada de "completo" |
| Sesgo de selección (solo trabajos publicados y terminados) | Reportarlo; no extrapolar a todo el mercado sin análisis |

## 9. Criterio para cerrar esta decisión

1. Dueño, datos, seguridad/privacidad y DBA aprobaron por escrito la ejecución, el entorno y el tratamiento de resultados.
2. Se validó la sintaxis y el plan (`EXPLAIN`) en una copia, y Q0 confirmó la estructura de `termsJson`.
3. Se ejecutó y el informe se entregó al responsable de datos y a costos, con los diagnósticos de calidad.
4. El responsable de datos definió qué evidencia adicional permite certificar el costo final (ningún escalón actual basta por sí solo) y costos fijó el tamaño mínimo de muestra y la métrica.
5. Se decidió, con ese informe, si hay datos para calibrar o si hay que **empezar a capturar costos reales** (plan de captura) antes de hablar de confianza "calibrada".

## 10. Observaciones del revisor sobre SQL (30-10-2026)

- **No aprobado para ejecución**: aunque se ha restringido el ámbito a un `tenantId` explícito, este SQL no está probado en PostgreSQL y debe pasar primero por `EXPLAIN` en una copia o réplica autorizada.
- **Integridad del grano**: dos `ProjectIntake` pueden señalar el mismo `Job`; antes de hablar de cantidad de trabajos únicos, añadir un conteo de duplicados y comprobar enlaces cruzados. Un `Contract.termsJson.totalAmount` plausible tampoco prueba, sin revisar el proceso de firmas, el precio contractual definitivo.
- **Seguridad de resultados**: el umbral `min_cell` es provisional; falta protección contra inferencia al comparar columnas, trimestres y salidas sucesivas, incluso cuando el propio SQL oculta las celdas pequeñas.
- **Rendimiento**: el `OR` de `ProjectExpense` debe revisarse con `EXPLAIN` y `EXPLAIN ANALYZE` únicamente en una copia/réplica autorizada y suficientemente representativa; verificar el coste de joins y `LATERAL`.
- **Sin calibración automática**: el coste pagado y final de la obra no está probado por gastos parciales; separar cobertura de evidencia de costos, conciliación financiera y validación por oficio. El propietario no ha aprobado muestras mínimas, umbrales ni métricas.

## 11. Siguientes pasos

> Sin fechas inventadas: las fija el owner al asignar responsables. Ningún paso se ejecuta sin la aprobación del anterior.
> Integra las observaciones del revisor (§10): ámbito por tenant, `detail_level`, ningún escalón acredita por sí solo el costo final y ninguna salida está autorizada para difusión.

| # | Acción | Responsable | Requiere antes | Entregable |
|---|---|---|---|---|
| 1 | Indicar los nombres de los roles de §2 y la fecha objetivo | Dueño (`@Samuelcastella`) | — | §2 completada |
| 2 | Definir el **criterio adicional de integridad y conciliación** de costos (ningún escalón actual acredita costo final) y revisar los escalones de §3 | Responsable de datos + costos | 1 | Criterio escrito |
| 3 | Añadir a la consulta el **conteo de intakes duplicados por `Job`** y la comprobación de enlaces cruzados; si se quiere desglose por organización, diseñar la cohorte derivada de `Job`/`Project` | Ingeniería + datos | 2 | SQL ajustado en un PR aparte |
| 4 | Preparar una copia restaurada o réplica de solo lectura y un rol con `SELECT` solo en las tablas de la consulta | DBA | 1 | Entorno y rol listos |
| 5 | Validar sintaxis y plan (`EXPLAIN`, y `EXPLAIN ANALYZE` solo en copia representativa) con **datos sintéticos**; comprobar la ausencia de cruces entre tenants | DBA + ingeniería | 3 y 4 | Informe de validación |
| 6 | Decidir `min_cell`, la protección frente a inferencia por resta entre escalones y subgrupos, y el destino y retención de los resultados | Seguridad y privacidad | 2 | Política de tratamiento |
| 7 | Autorizar por escrito la **primera** ejecución: un `tenant_id` explícito, `detail_level=summary`, entorno y fecha. `detail_level=detail` requiere autorización específica de seguridad/privacidad | Dueño | 5 y 6 | Autorización firmada |
| 8 | Ejecutar la sonda Q0 y confirmar la estructura de `Contract.termsJson`; si hace falta, ajustar el SQL en un PR aparte | DBA + ingeniería | 7 | Estructura confirmada |
| 9 | Ejecutar la consulta principal y registrar quién, cuándo y dónde. **Los resultados no se difunden** | DBA | 8 | Resultados agregados con acceso restringido |
| 10 | Revisar resultados y diagnósticos de calidad; fijar tamaño mínimo de muestra y métrica de error | Costos + revisión estadística | 9 | Informe y criterios |
| 11 | Decidir: calibrar con los datos existentes o **diseñar la captura de costos reales** | Dueño | 10 | Decisión registrada |

**Estado: `OPEN`.** El owner decide cuándo pasa a `DECIDIDA`.
