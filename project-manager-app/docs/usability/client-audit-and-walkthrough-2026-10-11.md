# Usabilidad Web Cliente — recorrido automatizado (páginas + tareas T1–T8, escritorio y móvil) + auditoría heurística/WCAG

- **Fecha:** 2026-10-11 · **Rama:** `docs/jobs-bids-projection-roadmap-status` @ `1c6325a8` (sin cambios de código de producto)
- **Alcance:** 24 rutas `/client/*` en escritorio 1440×900 y móvil 390×844, más las tareas T1–T8 en ambos tamaños. Cuenta `client@demo.semse` (seed local).
- **Entorno:** build de producción local (`next build` + servidor Next) contra API local (`nest start`) y Postgres en Docker. Datos del seed: 5 jobs, 2 proyectos, 1 disputa.
- **Evidencia:** páginas `run-2026-10-11-desktop/`, `run-2026-10-11-desktop-recheck/`, `run-2026-10-11-mobile/`; tareas `run-2026-10-11-tasks-desktop*/` y `run-2026-10-11-tasks-mobile/` (`tasks.json` + capturas por paso; en escritorio hubo 3 corridas: la `-b` y la `-c` repiten T1/T3/T4/T6 y T3 tras corregir mi script). Scripts reproducibles: `tests/usability/client-walkthrough.mjs` y `tests/usability/client-tasks.mjs`.
- **Plan de pruebas con usuarios:** `client-usability-test-plan.md`.

## 0. Qué cubre y qué NO cubre este informe

| Cubre | No cubre (pendiente) |
|---|---|
| Barrido de 24 pantallas en escritorio y móvil: estructura, errores de consola/red, axe-core WCAG 2.0/2.1 A+AA, tamaño de objetivos, desbordes, capturas. | **T4 (aprobar hito) y T6 (factura pendiente):** el seed no permite evaluarlas (ver §5.2). **Liberar pago** (T5) y **enviar la disputa** (T8): el script se detiene antes por ser acciones que mueven dinero o crean registros. |
| Tareas T1–T8 en escritorio y móvil: éxito, clics, campos, tiempo, capturas por paso. T3 y T1 se ejecutaron hasta el final. | **Comparar ofertas** (T3): el seed tiene un solo profesional. **Contraste real por elemento, teclado y lector de pantalla**: axe detecta solo ~30–40 % de los problemas. |
| Lectura visual de las capturas (heurística de Nielsen). | **Comprensión humana** (¿entienden el menú? ¿qué esperan al pagar?): eso solo lo miden las sesiones del plan. |

**Advertencias de método.**
- Los tiempos de carga (3–16 s) **no son fiables**: la máquina tiene 6 GB y estuvo bajo presión de memoria. No se reportan como hallazgo.
- Una primera pasada dio 500/502 en muchas llamadas. Causas verificadas y **ajenas a la app**: (a) faltaba `SEMSE_BOOTSTRAP_TOKEN` en mi montaje local (la web lo exige en producción, correctamente) y (b) Postgres fue inalcanzable ~1 min por presión de memoria/disco. Se corrigió el montaje y se repitieron las rutas afectadas; esos errores no aparecen en la tabla de abajo.
- Para el login local activé `SEMSE_DEMO_MODE=true` solo en el proceso de la web. Ningún `.env` fue modificado.

## 1. Resumen ejecutivo

La estructura base es buena: las 24 rutas responden 200, todas tienen `<main>`, `lang="es"` y un `h1` (salvo el estado de error de proyecto), no se mostró ningún `undefined`/`NaN`/`[object Object]`, y el dashboard comunica el estado con KPIs correctos.

Los problemas que más pesan para un cliente, en orden:

1. **El botón flotante de Prometeo tapa acciones y datos** (incluido "Fondear escrow" en el detalle del trabajo). Severidad 3.
2. **Accesibilidad de base rota en todas las pantallas:** botón de la cabecera sin nombre accesible (axe *critical*, 24/24) y contraste insuficiente (*serious*, 24/24, 153 nodos).
3. **Navegación sobrecargada e inconsistente:** 17 ítems en 4 grupos, doble estado activo en el wizard, mezcla de español neutro, voseo e inglés.
4. **Callejón sin salida:** un proyecto enlazado desde la lista muestra "Proyecto no encontrado".
5. **Estados internos expuestos al cliente:** `PENDING`, `medium · abrir contexto →`, `Provider por defecto: mock · modo mock`.

Lo que añadieron las tareas T1–T8 (§5) y la pasada móvil (§6):

6. **El modal de fondeo —donde el cliente decide pagar— muestra texto roto** ("crÃ©dito/dÃ©bito", "MÃ‰TODO DE PAGO") y, en móvil, el botón flotante tapa el botón de confirmar (U-20, U-21).
7. **Aceptar una oferta no pide confirmación** y, en móvil, deja la pantalla en blanco con estado "Publicado" durante unos 13 s aunque el trabajo ya está aceptado (U-22, U-23).
8. **Publicar un trabajo funciona (7 clics) pero el primer paso confunde:** las especialidades salen fuera de la vista —≈ 2,6 pantallas más abajo en móvil— y "Siguiente" no explica por qué está bloqueado (U-19).
9. **ProTools da un número seguro de sí mismo y erróneo:** tipo "Electricidad" por defecto; un baño de 6 m² sale a $798 con "Confianza 85 %" (U-25).
10. **"Finance Hub" habla como vendedor** dentro del rol Cliente (U-24): no hay dónde ver lo que se debe.

Lo que **sí** funciona y se confirmó: el borrador del wizard sobrevive a recargar (T2), el modal de fondeo muestra monto y proveedor (T5), no hay desbordes horizontales en móvil, y ProTools devuelve un estimado con salida directa a "Publicar trabajo" (T7). T4 y T6 no se pudieron evaluar con el seed (§5.2).

## 2. Hallazgos

Severidad (Nielsen 0–4). **Fuente:** A = automatizado, H = heurística (lectura de capturas), W = WCAG (axe). "Confirmar" = requiere validación con usuarios o móvil antes de actuar.

| ID | Sev | Fuente | Hallazgo | Evidencia | Heurística / WCAG |
|---|---|---|---|---|---|
| U-01 | 3 | H | El FAB de Prometeo se superpone al contenido: oculta el botón **"Fondear escrow"** en `/client/jobs/:id` y las insignias de estado (`Publica…`, `En prog…`) en el dashboard. | `client_jobs_job_demo_005__desktop.png`, `client_dashboard__desktop.png` | H8 minimalismo, H7 eficiencia; WCAG 1.4.10/2.4.11 (contenido oculto) |
| U-02 | 3 | W | Botón sin nombre accesible en `header` (probablemente campana/menú de icono) en **24/24** rutas (30 nodos). | axe `button-name` critical | WCAG 4.1.2, 1.1.1 |
| U-03 | 3 | W | Contraste insuficiente en **24/24** rutas (5–15 nodos por página, 153 total). Primer nodo reportado: dentro del `nav`. | axe `color-contrast` serious | WCAG 1.4.3 |
| U-04 | 3 | W | `select` sin nombre accesible en 5 rutas (leads, professionals, protools, payments, disputes) e `input` sin etiqueta en 2. `/client/disputes` tiene **10** campos sin etiqueta. | axe `select-name`/`label` critical | WCAG 1.3.1, 3.3.2, 4.1.2 |
| U-05 | 2 | A/H | Formulario de login: las `label` no están asociadas a sus `input` (`getByLabel` no los encuentra). | login, intento de automatización | WCAG 1.3.1, 3.3.2 |
| U-06 | 3 | A/H | **Callejón sin salida:** `/client/projects/proj_demo_002` y su copiloto muestran "Proyecto no encontrado" (404 en `buildops/projects/:id`) aunque el proyecto sale en la lista. Sin `h1`. | `client_projects_proj_demo_002__desktop.png` | H9 recuperación de errores, H1 estado del sistema |
| U-07 | 2 | H | **Doble estado activo** en el menú: en `/client/jobs/new` resaltan "Publicar trabajo" y "Mis proyectos" a la vez; en el detalle de un trabajo se resalta "Mis proyectos". | `client_jobs_new__desktop.png` | H1, H4 consistencia |
| U-08 | 2 | H | **Navegación de 17 ítems en 4 grupos** más "Principal", "Cuenta" e "IA". Nombres ambiguos para un no experto: "Leads & Clientes", "Hub Financiero", "Pagos" vs "Hub Financiero", "Estimador de obra", "Agentes". Dos cabeceras con la misma palabra "contratista/contratás". | dashboard | H2 lenguaje del usuario, H6 reconocer vs recordar; confirmar con tarea T0 |
| U-09 | 2 | H | **Mezcla de idiomas y registros:** voseo ("CONTRATÁS PROFESIONALES", "OFRECÉS TUS SERVICIOS") frente a tuteo ("Revisa propuestas", "Completa los pasos"); inglés ("Milestones", "Holdback", "Change Orders", "Finance Hub", "timeline", "Leads") junto a español ("Hitos", "Hub Financiero"). El nav dice "Hitos" y la página "Milestones". | dashboard, job detail, `finance` h1 "Finance Hub" | H4 consistencia, H2 |
| U-10 | 2 | H | **Terminología cambiante** para lo mismo: "propuestas" / "ofertas" / "candidatos" / "bids" ("Mis propuestas", "Propuestas recibidas", "Esperando candidatos"). | dashboard, job detail | H4 |
| U-11 | 2 | H | **Datos internos visibles al cliente:** estado `PENDING` en mayúsculas, `medium · abrir contexto →`, `PENDING · abrir contexto →`, y en `/client/payments` "Provider por defecto: mock · modo mock" con chips de proveedores (Stripe Connect, PayPal Payouts, Adyen, Bank/ACH). | job detail, payments | H2, H8; **confirmar** si "mock" aparece solo en entorno local |
| U-12 | 2 | H | Dashboard: la etiqueta del primer KPI aparece recortada ("RABAJOS ACTIVOS"); cuatro tarjetas ocupan ~80 % del ancho y dejan hueco a la derecha; "Dashboard" se repite en el `eyebrow` y en el título y la campana de notificaciones aparece dos veces (barra superior y página). | `client_dashboard__desktop.png` | H8 |
| U-13 | 2 | A | **Google Fonts bloqueada por la CSP** en 24/24 rutas (`Loading the stylesheet 'https://fonts.googleapis.com/…' violates the following Content Security Policy`). La tipografía Geist no carga y cae al fallback. | consola, todas las rutas | H4 coherencia visual; seguridad vs diseño: decidir (autoalojar la fuente o ampliar la CSP) |
| U-14 | 2 | A | Objetivos táctiles/clic < 24×24 px en **todas** las rutas (3–9 por página, `leads` y `disputes` los peores). | `results.json › targetsUnder24` | WCAG 2.5.8 (AA, 2.2) |
| U-15 | 2 | A | `/client/disputes` carga con errores de permisos: `403 GET /api/semse/agents/approvals` y `404 …/disputes/:id/comments`; la pantalla tiene también 7 controles sin nombre. | recheck | H9, WCAG 4.1.2; revisar RBAC de CLIENT sobre `agents:approvals` |
| U-16 | 1 | A | `404 GET /api/semse/jobs/:id/payments` en detalle de trabajo y pagos; `404 …/sse?channels=bids:default`; `503 …/cortex/context/stream`. No visibles al usuario pero ensucian la consola y pueden ocultar fallos reales. | consola | — |
| U-17 | 1 | H | Wizard paso 1: "Siguiente" aparece atenuado sin indicar por qué; 18 categorías sin buscador ni agrupación. El panel "Radar del proyecto" dice "Propuestas estimadas: 3-5 días" antes de elegir nada. | `client_jobs_new__desktop.png` | H5 prevención, H1; **confirmar** con T1 |
| U-18 | 1 | A | `/client/review` redirige a `/client/reviews` (dos rutas para lo mismo); `/client/account` no tuvo `h1` en una pasada y sí en otra (intermitente, revisar). | `results.json` | H4 |

### Lo que funciona bien (mantener)
- Agrupación "Como comprador / Como contratista" visible y lógica (G-CLI-08 se ve cumplido en pantalla).
- Dashboard con KPIs coherentes con los datos ("Trabajos activos 1, Esperando propuestas 3, Completados 1, $2,800") y bloque "Califica a tus profesionales" que invita a una acción concreta.
- Estados vacíos redactados con explicación y siguiente paso ("Cuando un profesional envíe una propuesta, podrás revisar presupuesto…").
- Migas de pan coherentes, un `h1` por pantalla, `<main>` y `lang="es"` en todas.
- Sin 5xx reproducibles con el entorno sano; ningún valor crudo (`undefined`, `NaN`) en pantalla.

## 3. Mapa de hallazgos a las hipótesis del plan de usuarios

| Pregunta del plan | Qué anticipa este recorrido | Dónde confirmarlo |
|---|---|---|
| P1 nav comprensible | U-08, U-09, U-10 apuntan a confusión de términos | T0 + comprensión de 6 ítems |
| P2 comprador vs contratista | Agrupación visible; riesgo por doble activo (U-07) y títulos con jerga | T0, T9 |
| P3 wizard | U-17 | T1, T2 |
| P4 dinero antes de fondear/liberar | **U-01** puede impedir ver/pulsar "Fondear escrow"; U-11 expone jerga de proveedores | T5 (alta prioridad) |
| P5 qué hago ahora | Dashboard fuerte; detalle de trabajo muy largo (7 bloques apilados en una columna) | T3, T4 |
| P6 Prometeo | El FAB es intrusivo (U-01) y su valor no se explica | T10 |
| P7 disputas | U-15 + 10 campos sin etiqueta en `/client/disputes` | T8 |

## 4. Acciones recomendadas (orden sugerido)

**Rápidas (≤ 1 día cada una, bajo riesgo)**
1. U-02: dar `aria-label` al botón de icono de la cabecera.
2. U-04/U-05: asociar `label`↔`input` y nombrar los `select` (login, filtros, disputas, protools).
3. U-01: mover el FAB o reservar margen inferior/derecho (`pb-24` ya existe en algunas vistas) para que nunca cubra CTA ni insignias.
4. U-07: corregir la lógica de ítem activo del nav.
5. U-06: si el proyecto no existe en BuildOps, ocultar el enlace o mostrar un mensaje con la causa y una acción.
6. **U-20: arreglar la codificación de `EscrowFundModal.tsx`** (8 líneas con "Ã…"; texto UTF-8 que se leyó como Windows-1252 y se volvió a guardar; en `apps/web` solo apareció en este archivo) y buscar el mismo patrón en el resto del repo antes de cerrar.
7. U-21: que el FAB no cubra el pie de ningún modal (ocultarlo mientras haya un `dialog` abierto).
8. ~~U-30~~ retirado (ver §2: el segundo `<main>` está oculto).
9. U-29: avisar cuando la sugerencia de IA falle y traducir `high/medium/low`; añadir campo numérico al presupuesto.

**Medias**
6. U-03: revisar tokens de color de texto secundario/etiquetas (coordinar con `semse-design-tokens`).
7. U-09/U-10: glosario único de términos (hitos/propuestas/pagos/finanzas) y un solo registro (neutro).
8. U-11: ocultar `PENDING`, `medium` y la configuración de proveedores al rol cliente; traducir estados.
9. U-13: decidir entre autoalojar Geist o ajustar la CSP.
10. U-15/U-16: revisar permisos de CLIENT y llamadas que devuelven 403/404 esperados.

**Decisiones de producto (no unilaterales)**
11. U-08: simplificar el menú de 17 ítems (¿colapsar "Como contratista" por defecto para quien solo compra?).
12. U-22/U-23: ¿confirmación al aceptar una oferta? ¿Qué debe ver el cliente mientras se procesa y después?
13. U-24: ¿vista de "lo que debo pagar" para el comprador, separada de las herramientas de facturación del contratista?
14. U-19/U-25: ¿rediseñar el paso 1 del wizard (especialidad visible sin scroll) y detectar el tipo de trabajo en ProTools a partir de la descripción?

Cualquier cambio de código debe seguir el flujo SDD de `AGENTS.md` y el skill `semse-audit-remediation`; este informe no modifica código de producto.

## 5. Tareas T1–T8 (escritorio y móvil)

### 5.1 Resultados

| Tarea | Escritorio | Móvil | Lo que se observó |
|---|---|---|---|
| **T1** Publicar trabajo | ✅ 7 clics · 2 campos · 31–44 s | ✅ 7 clics · 2 campos · 48 s | Se completa y termina en el detalle del trabajo creado. Pero las **especialidades aparecen bajo el pliegue** (y=1027 px con pantalla de 900; **y=2160 con pantalla de 844 en móvil, ≈ 2,6 pantallas**) y "Siguiente" queda deshabilitado sin decir por qué. La sugerencia de IA tardó 7–8 s. |
| **T2** Recargar a mitad del wizard | ✅ | ✅ | El borrador y el título se recuperan con banner verde ("Recuperamos tu borrador guardado…"). **Confirma G-CLI-03 en un build de producción.** El borrador está en `sessionStorage`: sobrevive a recargar, no a cerrar la pestaña. |
| **T3** Aceptar oferta | ⚠️ aceptó (BD: `ACCEPTED`) · 1 clic | ⚠️ aceptó tras **13 s** de "Aceptando…" | **Sin ningún paso de confirmación** (compromete al cliente y reserva al profesional). Tras aceptar en móvil la pantalla queda **en blanco con la insignia "Publicado"** aunque la BD ya dice `ACCEPTED`. En escritorio, el aviso "Esperando candidatos — revisa propuestas cuando lleguen" sigue visible con una propuesta ya presente. La tarjeta de oferta muestra el **correo** del profesional como nombre, sin foto ni datos para decidir. |
| **T4** Aprobar un hito entregado | ❌ no evaluable | ❌ no evaluable | "Mis hitos" muestra 0 / 0 / $0 y tarjetas en carga; `/client/projects/proj_demo_001` y `proj_demo_002` dicen **"Proyecto no encontrado"** aunque el seed tiene un hito `SUBMITTED` (`ms_demo_002`). Ver §5.2. |
| **T5** Fondear / liberar pago | ⚠️ parcial (modal) | ⚠️ parcial (modal) | El modal **sí muestra monto, moneda y proveedor**, y sugiere el presupuesto ("Usar presupuesto sugerido: $500"). Pero: texto con **codificación rota** (U-20) y, en móvil, el **botón flotante de Prometeo tapa el botón de confirmar** (U-21). No se confirmó ningún pago. |
| **T6** Encontrar factura pendiente | ❌ no evaluable | ❌ no evaluable | El seed no tiene facturas. Además, "Finance Hub" del cliente es una herramienta de **emisión** ("Por cobrar", "Cobrado", "Nueva factura", "Registrar gasto"); no hay vista de lo que el cliente **debe pagar** (U-24). |
| **T7** Estimar con ProTools | ✅ 1 clic · 2 campos · 14–24 s | ✅ | Funciona y ofrece "Publicar trabajo" con el estimado. Pero **"Tipo de trabajo" viene preseleccionado en "Electricidad"** y no se corrige según la descripción: para un baño de 6 m² dio **$798 con "Confianza 85 %"** (U-25). |
| **T8** Abrir disputa | ✅ llega al formulario · 1 clic · 1 campo | ✅ | Hay que **elegir un trabajo** antes; un mensaje de error rojo ("Selecciona un trabajo y describe la razón…") **ya aparece con el formulario rellenado** (U-26). No se envió. |

### 5.2 Límites del seed y qué NO concluir

- **T4:** que "Proyecto no encontrado" aparezca para los dos proyectos del seed puede ser (a) un hueco del seed (los hitos viven en tablas de BuildOps que el seed no crea) o (b) una incoherencia real entre lista (`/v1/projects`) y detalle (`/v1/buildops/projects/:id`). **No está resuelto.** Para decidirlo hay que crear un proyecto desde el flujo real (T3 → hito → entrega del profesional).
- **T6:** sin facturas en el seed no se puede evaluar la búsqueda. La observación de U-24 sobre el propósito de la pantalla sí es independiente de los datos.
- **T3:** solo hay un profesional, así que "comparar y elegir" no se probó.
- Los tiempos (13 s de "Aceptando…", 7–8 s de IA, 14–48 s por tarea) vienen de una máquina de 6 GB y con IA local no configurada: son cotas superiores, no medidas de producción.
- Los clics cuentan solo las acciones del script (sin scroll ni correcciones humanas); un participante real hará más.

### 5.3 Hallazgos nuevos (continúan la tabla de §2)

| ID | Sev | Tarea | Hallazgo | Heurística / WCAG |
|---|---|---|---|---|
| U-19 | 3 | T1 | **Especialidades fuera de la vista tras elegir categoría** (escritorio y, sobre todo, móvil) y "Siguiente" deshabilitado sin motivo visible. Un usuario nuevo puede creer que la app no responde. | H1 estado del sistema, H5 prevención de errores |
| U-20 | 3 | T5 | **Mojibake (UTF-8 mal decodificado) en el modal de fondeo**: "crÃ©dito/dÃ©bito", "MÃ‰TODO DE PAGO", "SimulaciÃ³n", "autorizaciÃ³n", "Monto invÃ¡lido", "Cerrar confirmaciÃ³n" (hasta el `aria-label`). Está en `apps/web/app/components/payments/EscrowFundModal.tsx` (9 líneas). Es el punto donde el cliente decide pagar: erosiona la confianza. | H2, H4; WCAG 3.1.1 |
| U-21 | 3 | T5 | En móvil, el **FAB de Prometeo cubre el botón principal del modal** de fondeo (refuerza U-01). | H8; WCAG 2.4.11 |
| U-22 | 3 | T3 | **Aceptar una oferta no pide confirmación** y no explica la consecuencia (reservar al profesional, fondear escrow). G-CLI-01/02 cubrieron el dinero y las disputas, pero no este compromiso. | H5 prevención de errores |
| U-23 | 3 | T3 | **Estado inconsistente tras aceptar** (móvil): 13 s sin feedback útil, luego pantalla en blanco con insignia "Publicado" y BD en `ACCEPTED`; en escritorio, aviso "Esperando candidatos" con propuesta presente. | H1 estado del sistema |
| U-24 | 3 | T6 | **"Finance Hub" habla el idioma del vendedor** ("Por cobrar", "Cobrado", "Nueva factura") dentro del rol Cliente: quien contrata no encuentra lo que debe pagar. Refuerza la mezcla de personas (G-CLI-08). *Confirmar con usuarios.* | H2, H4 |
| U-25 | 3 | T7 | **Valor por defecto engañoso en ProTools**: "Tipo de trabajo = Electricidad" para cualquier descripción; resultado de $798 con "Confianza 85 %" para un baño. Riesgo de decidir presupuesto con un número erróneo y seguro de sí mismo. | H5, H9 |
| U-26 | 2 | T8 | Error de validación **visible antes de enviar** (con el formulario ya completo) y sin explicar qué pasa con los fondos retenidos al abrir una disputa. | H5, H9 |
| U-27 | 2 | T8 | `/client/disputes` expone **identificadores y estados crudos** ("Proyecto proj_demo_001 · Trabajo job_demo_001", "Estado in_progress") y jerga ("Workspace abierto", "Criterio del copiloto"); el panel derecho **se corta por el borde** a 1440 px. | H2, H8; WCAG 1.4.10 |
| U-28 | 2 | T3 | La tarjeta de oferta muestra el **correo del profesional** como nombre y "Sin calificaciones": faltan nombre, foto, trabajos y verificación para elegir. *Parte puede ser dato de seed.* | H6 reconocer vs recordar |
| U-29 | 1 | T1 | La **sugerencia de presupuesto ignora errores** (`catch { /* ignore */ }` en `jobs/new/page.tsx`): si la IA falla, el botón vuelve a su estado sin avisar. La confianza se muestra como `high/medium/low` en inglés. Los dos deslizadores de presupuesto no tienen etiqueta ni campo numérico. | H9, WCAG 3.3.1/1.3.1 |
| U-30 | 0 | todas | *(Retirado tras verificar.)* Hay dos `<main>` en el DOM, pero el segundo está dentro de un contenedor con la clase `hidden` (`AppShell` se usa solo como barra lateral con `contentClassName="hidden"`), así que **no está en el árbol de accesibilidad** y axe no lo marcó. Solo es DOM redundante que rompe selectores como `locator("main")`. No requiere acción. | — |

## 6. Pasada móvil (390×844) — 24 rutas

- **Sin desbordes horizontales en ninguna ruta.** Es un buen punto de partida responsive.
- **Botón del menú sin nombre accesible en 24/24** (`.mobile-menu-btn`, 54 nodos `button-name`): es la causa de U-02 en móvil. En escritorio el nodo es el mismo tipo de botón de icono de la cabecera.
- **Objetivos táctiles < 44 px** (recomendación WCAG 2.5.5 / guías móviles): `leads` 38 de 40 controles, `disputes` 31 de 36, `documents` 16 de 22, `jobs/new` 13 de 33, `payments` 13 de 15, `dashboard` 11 de 19.
- **Contraste insuficiente en 8 rutas** (28 nodos; peores: `documents` 10, `disputes` 7). Menos que en escritorio porque la lista de elementos cambia con el layout.
- `select-name` en 5 rutas, `label` en 2 y un `nested-interactive` en `/client/milestones` (un botón dentro de otro control).
- Las 500/502 de esta pasada coinciden con caídas de la conexión a Postgres local (ver §0); no se cuentan.
- El FAB de Prometeo ocupa ~56×56 px fijos en cada pantalla de 390 px y tapa contenido (U-01, U-21).

## 7. Próximos pasos de esta línea

1. **Datos de partida más ricos** (un proyecto de BuildOps con hito entregado, una factura por pagar, 2–3 profesionales con nombre) para poder evaluar T3-comparar, T4 y T6, y decidir si U-06 es seed o bug.
2. **Prueba de liberar pago y de enviar disputa** en un entorno con Stripe de prueba y datos desechables.
3. **Sesiones con usuarios** según `client-usability-test-plan.md`; las tareas ya están ensayadas y sus clics base sirven de referencia.
4. Repetir ambos scripts tras los arreglos rápidos y comparar con esta línea base.

## 8. Cómo reproducir

```bash
# desde project-manager-app/
docker compose -f infra/docker/compose.semse-mvp.yml up -d
pnpm db:migrate && pnpm db:seed
# API con SEMSE_BOOTSTRAP_TOKEN y web (build de producción) con el MISMO token y SEMSE_DEMO_MODE=true
VIEWPORT=desktop AXE_PATH=<ruta a axe.min.js> node tests/usability/client-walkthrough.mjs     # páginas
VIEWPORT=mobile  TASKS=T1,T2,T5,T7,T8 node tests/usability/client-tasks.mjs                   # tareas
# opcional: ONLY_ROUTES=/client/payments  OUT_DIR=docs/usability/<carpeta>  T3_JOB=job_demo_003
```
Notas: en Git Bash anteponer `MSYS_NO_PATHCONV=1` si se usa `ONLY_ROUTES`. `axe-core@4.10.2` se instaló fuera del repo. **T3 acepta una oferta y modifica la BD local**; usar un seed desechable. Si la BD local es inestable, los errores 500 de esas corridas no son hallazgos.

## 9. Arreglos rápidos aplicados

Rama `fix/usability-quick-wins-client` (desde `origin/main` @ `432a9e39`), **sin commitear**. Cambios de texto, accesibilidad y presentación; ninguno toca lógica de dinero, permisos ni datos.

| ID | Cambio | Archivos | Verificación |
|---|---|---|---|
| U-20 | Reparada la codificación del modal de fondeo ("crÃ©dito" → "crédito", "MÃ‰TODO" → "MÉTODO", etc., 9 líneas). Era el único archivo con el problema en `apps/` y `packages/`. | `app/components/payments/EscrowFundModal.tsx` | En el build: sin `Ã`/`Â`/`â€` en el diálogo, en escritorio y móvil (captura `verify_modal_mobile.png`). |
| U-02 | Nombre accesible para el botón de menú móvil (`ui.openMenu`: "Abrir menú" / "Open menu") y para la campana de notificaciones (con el número de no leídas, `aria-expanded`) y su botón de cerrar. | `app/(app)/layout.tsx`, `components/semse/NotificationBell.tsx`, `lib/language-context.tsx` | `button-name` bajó de **24 a 6 rutas** (30 → 6 nodos). Menú móvil: `aria-label="Abrir menú"`. |
| U-01 / U-21 | Los widgets flotantes (mascota de Prometeo y botón del chat de agentes) se ocultan mientras haya un modal (`aria-modal="true"`) y vuelven al cerrarlo; el área principal tiene más margen inferior (200 px, 240 px para el profesional) para poder desplazar el contenido por encima. | `lib/use-modal-open.ts` (nuevo), `components/ai/agent-chat-panel.tsx`, `app/components/prometeo/PrometeoCopilot.tsx`, `app/(app)/layout.tsx` | Mascota: visible → oculta con modal → visible al cerrar, en escritorio y móvil. El botón azul del chat se ve oculto en la captura móvil; no lo medí por código (mi selector lo excluía). |
| U-07 | El menú resalta **un solo ítem**: gana la coincidencia más específica y el prefijo debe caer en frontera de segmento. Pruebas unitarias nuevas. | `lib/navigation-shell.ts`, `tests/unit/navigation-shell.test.ts` | 4/4 pruebas pasan; `/client/jobs/new` solo resalta "Publicar trabajo" (captura `verify_nav_jobs_new.png`). |
| U-04 / U-05 | Etiquetas asociadas en el login (`htmlFor`/`id`, `autoComplete`, `role="alert"` en el error); `aria-label` en 6 desplegables y en los 2 deslizadores de presupuesto. | `app/login/page.tsx`, páginas de `leads`, `professionals`, `payments`, `disputes`, `protools`, `jobs/new` | `getByLabel(email/contraseña)` ahora funciona. `select-name`: 8 → 2 nodos. |
| U-29 | La sugerencia de presupuesto con IA muestra un mensaje cuando falla (antes `catch { /* ignore */ }`) y la confianza sale en español (alta/media/baja). | `app/(app)/client/jobs/new/page.tsx` | Revisión de código y typecheck; no se forzó el fallo en pantalla. |

**Comprobaciones:** `tsc --noEmit` de `apps/web` con código de salida 0; ESLint de los archivos tocados con 0 errores (3 avisos ya existentes en líneas que no toqué); `next build` con código 0; prueba unitaria de navegación 4/4.

**Resultado del recorrido repetido (24 rutas, escritorio):**

| Regla axe | Antes (rutas / nodos) | Después |
|---|---|---|
| `button-name` (crítica) | 24 / 30 | **6 / 6** |
| `select-name` (crítica) | 5 / 8 | **1 / 2** |
| `label` (crítica) | 2 / 3 | 2 / 3 |
| `color-contrast` (seria) | 24 / 153 | 24 / 145 (sin cambios intencionales) |

**Lo que NO se arregló (y por qué)**
- **U-03 contraste:** requiere decidir tokens de color (coordinar con `semse-design-tokens`); no es un arreglo rápido.
- **U-06 callejón sin salida de proyecto:** la causa no está decidida (hueco del seed o incoherencia lista/detalle; ver §5.2).
- **Quedan 6 botones sin nombre** (`leads`, `milestones`, `marketplace`, `bids`, `finance`, copiloto de proyecto), `label` en el control de ProTools y el `input[type=file]` de disputas, y 2 `select` en disputas. Son botones de icono en cada página; conviene revisarlos uno a uno.
- **U-01 no desaparece del todo:** la mascota sigue encima del contenido cuando no hay modal y no se ha llegado al final de la página. Reducir su tamaño o moverla es una decisión de diseño.
- **U-09 a U-11, U-13, U-22 a U-25, U-27:** textos, glosario y comportamiento de producto; no son arreglos rápidos.
- **Nota de entorno:** al cambiar a `origin/main` hubo que recompilar `packages/*` y regenerar Prisma; la API no arrancaba con los paquetes compilados de la rama anterior (`metadata` no existía en el esquema de evidencia). No es un cambio de código.
