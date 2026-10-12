# Plan de pruebas de usabilidad con usuarios — Web Cliente (`/client/*`)

- **Estado:** DRAFT v1 (2026-10-11)
- **Alcance:** `apps/web/app/(app)/client/**` (rol CLIENT). Fuera de alcance: Worker/PRO, Admin, app móvil.
- **Entorno:** local o staging con datos semilla. **No** producción: las cuentas demo están deshabilitadas allí y las tareas de pago/disputa mueven dinero real.
- **Relación con otros entregables:** este plan es la línea base humana. Los recorridos automatizados (Playwright) y la auditoría heurística/WCAG se ejecutan después sobre las mismas tareas T1–T8 para poder comparar resultados (ver §9).
- **Contexto previo:** `docs/specs/ui/client-flows-remediation.spec.md` (gaps G-CLI-00…09, casi todos resueltos). Esta ronda verifica con personas lo que esa auditoría verificó con código.

---

## 1. Objetivos

1. Medir si un cliente nuevo puede **publicar un trabajo, elegir profesional, aprobar hitos y pagar** sin ayuda.
2. Validar con personas reales las correcciones de la auditoría 2026-07 que solo se verificaron en código: confirmación de pagos, wizard con borrador, agrupación "Como comprador / Como contratista", dashboard con KPIs correctos.
3. Detectar fricción en la **navegación de 14 ítems** del rol Cliente y en la mezcla de dos personas (dueño que contrata vs. contratista con CRM de leads, decisión G-CLI-08).
4. Obtener una línea base cuantitativa (éxito, tiempo, errores, SUS) para comparar en rondas futuras.

## 2. Preguntas de investigación

| # | Pregunta | Hipótesis a refutar |
|---|---|---|
| P1 | ¿Entienden qué hace cada ítem del menú sin ayuda? | Los nombres "Leads", "Mis ofertas", "ProTools", "Finanzas" y "Pagos" se confunden entre sí. |
| P2 | ¿Distinguen "Como comprador" de "Como contratista"? | El agrupamiento resuelve la mezcla de personas. |
| P3 | ¿Completan el wizard de 4 pasos sin abandonar? | El paso de presupuesto (sugerencia IA) genera desconfianza o confusión. |
| P4 | ¿Entienden qué pasa con su dinero antes de fondear/liberar? | El modal de confirmación muestra monto y consecuencia con claridad suficiente. |
| P5 | ¿Saben dónde está el estado de su proyecto y qué se espera de ellos? | El dashboard comunica "qué hago ahora" sin explorar. |
| P6 | ¿Encuentran y usan Prometeo Copilot? | Su valor es descubrible y el error de sesión expirada es comprensible. |
| P7 | ¿Pueden abrir y entender una disputa? | El flujo y el resultado (`pro_favor`) no sorprenden. |

## 3. Participantes

**Muestra:** 8 personas (5 son suficientes para detectar ~85 % de problemas por persona-tarea; 8 permite cubrir ambos segmentos).

| Segmento | n | Perfil | Reclutamiento |
|---|---|---|---|
| A — Dueño que contrata | 5 | Ha contratado una obra/servicio en los últimos 12 meses; no usa software de gestión de obra. | Red de clientes, contactos del equipo, comunidades locales. |
| B — Contratista/gestor | 3 | Gestiona varios clientes; usaría Leads, Marketplace y Ofertas. | Profesionales ya registrados en SEMSE. |

Exclusiones: empleados de SEMSE, quien participó en el diseño, quien ya vio la app. Incentivo sugerido a definir por el equipo. Una persona por sesión; idioma de la sesión: español.

## 4. Formato de sesión

- **Tipo:** moderada, individual, presencial o remota con pantalla compartida y grabación (con consentimiento).
- **Duración:** 60 min = 5 intro + 5 preguntas previas + 35 tareas + 10 cuestionarios + 5 cierre.
- **Método:** pensar en voz alta; el moderador no ayuda salvo que la persona esté bloqueada > 3 min (se registra "asistida").
- **Dispositivo:** laptop 1440×900 como base; 2 sesiones (una de cada segmento) en móvil por navegador (390×844) para detectar problemas responsive.
- **Cuenta:** `client@demo.semse` sembrada localmente, reseteada entre sesiones. Dataset inicial: 1 job aceptado con hitos, 1 job publicado con 3 ofertas, 1 factura pendiente.

## 5. Tareas

Cada tarea se lee al participante como escenario, sin nombrar botones ni menús.

| ID | Escenario (lo que se le dice) | Ruta esperada | Éxito | Seg. |
|---|---|---|---|---|
| T0 | "Acabas de entrar. Cuéntame qué crees que puedes hacer aquí y qué harías primero." | `/client/dashboard` | Describe ≥ 2 funciones correctas. | A, B |
| T1 | "Necesitas reparar una tubería en tu cocina. Publica el trabajo con un presupuesto que te parezca razonable." | `/client/jobs/new` | Job publicado (DRAFT→POSTED) sin ayuda. | A |
| T2 | "A mitad de llenar el formulario, recarga la página por accidente. Continúa." | wizard | Recupera el borrador y termina. | A |
| T3 | "Llegaron ofertas a tu trabajo. Compara y elige a quien contratarías." | `/client/jobs/:id` | Acepta una oferta justificando el criterio. | A |
| T4 | "El profesional dice que terminó el primer hito. Revisa la evidencia y decide." | `/client/milestones` | Aprueba o rechaza con motivo. | A |
| T5 | "Quieres dejar el dinero reservado para este trabajo y luego liberar el pago del primer hito." | `/client/payments` | Fondea y libera; **dice en voz alta el monto** que está por mover. | A |
| T6 | "Tienes una factura pendiente. Encuéntrala y dime cuánto debes y a quién." | `/client/finance` | Localiza monto y concepto. | A, B |
| T7 | "Quieres saber cuánto podría costar un baño de 6 m² antes de pedir ofertas." | `/client/protools` | Obtiene estimado y explica qué significa. | A |
| T8 | "No estás conforme con el trabajo entregado. ¿Qué harías?" | disputa | Inicia disputa; explica qué espera que pase. | A |
| T9 | "Quieres ver nuevas oportunidades de trabajo para tu empresa y enviar una oferta." | `/client/marketplace`, `/client/leads` | Llega a una oferta enviada. | B |
| T10 | "Pregúntale a la IA qué falta para cerrar tu proyecto." | `/client/projects/:id/copilot` | Encuentra Prometeo y obtiene respuesta o error comprensible. | A, B |

Orden: T0 siempre primero; T1→T8 en secuencia (dependen entre sí); T9–T10 contrabalanceados.

## 6. Métricas

| Métrica | Cómo | Umbral objetivo |
|---|---|---|
| Éxito de tarea | 0 fallo / 0.5 con ayuda o desvío grave / 1 éxito | ≥ 80 % T1–T5; ≥ 70 % resto |
| Tiempo en tarea | Cronómetro desde fin de lectura | T1 ≤ 6 min, T5 ≤ 3 min, resto ≤ 3 min |
| Errores | Clics en elementos incorrectos, retrocesos, abandonos | ≤ 2 por tarea |
| Ease (SEQ) | 1–7 tras cada tarea | media ≥ 5,5 |
| SUS | 10 preguntas al final | ≥ 68 (promedio de industria); meta 75 |
| Confianza en pagos | "¿Qué tan seguro estás de cuánto pagaste?" 1–5 tras T5 | media ≥ 4 |
| Comprensión de nav | Tarea de card-sorting verbal: explicar 6 ítems del menú | ≥ 5/6 correctos |
| Hallazgos | Severidad 0–4 (Nielsen) × frecuencia | ver §8 |

## 7. Guion del moderador

**Introducción (leer):** "Estamos probando la aplicación, no a ti. No hay respuestas incorrectas. Piensa en voz alta. Puedo no responder preguntas porque quiero ver cómo lo harías solo. Puedes parar cuando quieras. ¿Autorizas grabar pantalla y voz solo para análisis interno?"

**Preguntas previas:** experiencia contratando obras; apps usadas para ello; mayor frustración en la última contratación; cómo suele pagar.

**Reglas de la sesión:**
- No nombrar etiquetas de la UI. No dar pistas. Si se bloquea: primero "¿qué esperabas ver?", luego repregunta, y solo después ayuda (marcar "asistida").
- Anotar literalmente frases, dudas, expresiones y el primer clic.
- Tras T5 detener y preguntar: "¿Qué pensaste que iba a pasar con el dinero cuando pulsaste ese botón?"

**Cierre:** lo mejor / peor; qué cambiarías; ¿lo recomendarías a alguien que contrata obras? (NPS 0–10); SUS.

## 8. Análisis y reporte

- **Severidad (Nielsen):** 0 no es problema · 1 cosmético · 2 menor · 3 mayor · 4 catastrófico (impide completar o pierde dinero/datos).
- **Prioridad** = severidad × % de participantes afectados. Todo hallazgo ≥ 3 o que afecte ≥ 3 de 8 se convierte en ítem de `docs/AUDIT_REMEDIATION_PLAN.md`.
- **Entrega:** informe en `docs/reportes/AAAA-MM-DD_usabilidad_cliente_ronda1.md` con: resumen ejecutivo, tabla de métricas por tarea, top 10 hallazgos con evidencia (clip + cita), recomendaciones, y comparación con las corridas automatizadas.
- Registro por hallazgo: ID, tarea, descripción, evidencia, severidad, frecuencia, heurística violada, propuesta, dueño.

## 9. Cruce con las otras dos líneas de trabajo

| Línea | Qué cubre | Qué aporta frente a las sesiones |
|---|---|---|
| Recorridos automatizados (Playwright) | T1–T8 como script: nº de pasos y clics, tiempos de carga, errores de consola/red, capturas por estado (loading/empty/ready/error) en desktop y móvil. | Fricción medible y repetible; detecta regresiones entre rondas. No mide comprensión. |
| Auditoría heurística + accesibilidad | Nielsen (10 heurísticas) + WCAG 2.1 AA sobre las 25 pantallas `/client/*`. | Cobertura total de pantallas, incluidas las que no entran en una sesión. No mide comportamiento real. |

Los tres se reconcilian en una matriz *hallazgo × fuente*; los hallazgos confirmados por ≥ 2 fuentes suben un nivel de prioridad.

## 10. Preparación y riesgos

- **Datos:** script de reseteo del dataset por sesión (pendiente de definir sobre el seed existente `packages/db/prisma/seed.ts`).
- **Pagos:** usar Stripe en modo test; el participante nunca ve tarjetas reales. `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` de prueba requerida localmente.
- **Sesgo:** el wizard guarda el borrador en `sessionStorage` (sobrevive a recargar, no a cerrar la pestaña); usar ventana nueva o limpiar almacenamiento entre participantes.
- **Prometeo (T10):** requiere LLM local (Ollama `qwen2.5:3b`) o credenciales; si no está disponible, T10 se evalúa solo por descubrimiento y por el mensaje de error.
- **Ética:** consentimiento por escrito, datos de participantes anonimizados (P1…P8), grabaciones retenidas máximo 90 días.

## 11. Cronograma sugerido

| Día | Actividad |
|---|---|
| 1 | Aprobar plan, reclutar, preparar entorno y dataset. |
| 2 | Piloto con 1 persona y ajuste de tareas/tiempos. |
| 3–4 | 8 sesiones. |
| 5 | Análisis, matriz de hallazgos y reporte consolidado con automatizados + heurística. |

## 12. Pendientes para ejecutar

- [ ] Elegir incentivo y canal de reclutamiento.
- [ ] Confirmar entorno (local vs. staging) y levantar API + web con datos semilla.
- [ ] Definir cuenta/rol B para el segmento contratista.
- [ ] Aprobar este plan antes de pasar a Playwright y a la auditoría heurística.
