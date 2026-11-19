# Reporte: correcciones de revisión del Ecosystem Digital Twin

**Fecha:** 2026-11-16  
**Rama:** `feat/ecosystem-digital-twin-3d`  
**PR:** #1157  
**Base local revisada:** `dd1c3f5aac6dfa8ade7ea1f8ba21edeb2a1a2705`  
**Primer delta remoto validado:** `9734db95c87a13c61a9c7df50c6e35de76079e22`  
**Alcance:** doce hilos de revisión, agrupados en once causas; dos hilos describen la misma niebla/clipping móvil.

## Resumen

Se reprodujeron los hallazgos, se añadieron regresiones y se aplicaron correcciones acotadas al layout, la escena Three.js, la vista 2D, las cabeceras de la preview, el Dockerfile opcional y las pruebas. No se alteraron los 33 IDs, los nueve dominios canónicos, los contratos del BFF, los flujos de negocio ni el modelo Prisma.

El mapa conserva la distinción entre madurez de registro y salud runtime: `runtimeHealth` y `observedAt` por nodo siguen siendo `null` cuando el contrato no los mide. El fixture E2E y `local-digital-twin-test-only` son exclusivamente datos de prueba local, no credenciales ni evidencia de producción.

## Hallazgos y correcciones

| Comentario | Hallazgo | Corrección y regresión |
|---|---|---|
| `4577412402`, `4577414087` | La distancia móvil aumentaba, pero `camera.far`, niebla y el límite de OrbitControls conservaban la escala de escritorio. | Escalar encuadre, plano lejano, niebla y `maxDistance` con el mismo factor; actualizar `maxDistance` antes de `controls.update()`. Los E2E exigen 33/33 centros visibles y cero recortados o ocultos por niebla en público y admin móvil. |
| `4577412439` | Atenuar un nodo mutaba un `THREE.Color` compartido y alteraba colores posteriores. | Clonar antes de `multiplyScalar`. El E2E compara los colores reales de las 33 instancias antes y después de filtrar. |
| `4577412509` | Faltaba el reporte obligatorio en `docs/reportes/`. | Este documento registra hallazgos, comandos, resultados, límites y estados. |
| `4577412590` | La animación SMIL podía quedar consumida antes de una reproducción tardía. | `begin="indefinite"` e inicio explícito con `beginElement()` al cambiar el nonce. El E2E espera cuatro segundos y comprueba desplazamiento real y finalización. |
| `4577412648` | El Dockerfile raíz era ambiguo y activaba framing embebido por defecto. | Documentar que es una imagen Next opcional, que Railway web usa `Dockerfile.web` y que la preview estática no lo consume; `SEMSE_PREVIEW_EMBEDDED=false` por defecto. Test unitario de contrato. |
| `4577412707` | El modo embebido eliminaba protecciones anti-clickjacking en todas las rutas. | Mantener `frame-ancestors 'none'` y `DENY` globalmente; relajar únicamente `/semse-consciousness-map` cuando el opt-in está activo, con CSP limitada a Kimi y `SAMEORIGIN` como fallback restrictivo. Tests para ambos modos. |
| `4577414089` | Los nodos SVG 2D no mostraban foco visible. | Añadir un anillo cian independiente de selección. El E2E enfoca el nodo y exige opacidad computada `1`. |
| `4577414091` | Las aristas 2D medían 0,07/0,14 píxeles CSS al usar `non-scaling-stroke`. | Usar 1 píxel para relaciones y 2 para flujo/selección, con mayor opacidad. El E2E comprueba un mínimo de 1 píxel. |
| `4577466398` | El secreto de la cookie E2E estaba fijado y no era portable. | Resolver `SEMSE_WEB_SESSION_SECRET`, luego `AUTH_SECRET`, con el mismo fallback de desarrollo que el servidor. En producción de prueba se inyecta explícitamente un valor local en servidor y firmante. |
| `4577466404` | `disputes` y `trust_passport` se solapaban; la revisión exhaustiva encontró otro par por debajo del umbral. | Sustituir ángulos hash independientes por separación angular uniforme por dominio, conservando PRNG sembrado, orden estable, capas y radio dentro del contrato. El unitario recorre los 528 pares y exige al menos 1,5 unidades en 2D y 3D; el E2E selecciona vecinos de forma independiente. |
| `4581903499` | Al cambiar de 3D a 2D durante un flujo, `beginElement()` reiniciaba el pulso, mientras el padre conservaba el deadline original. | Derivar el tiempo transcurrido de `playback.startedAt`, iniciar SMIL y avanzar el reloj de esa SVG desde su tiempo actual. Guardar el nonce iniciado evita dobles reinicios en StrictMode. La regresión cambia de vista tras 1,9 segundos, exige tiempo activo coherente, duración de 2,6 segundos y retirada finita del pulso. |

## Archivos del delta

- `Dockerfile`.
- `apps/web/components/semse/digital-twin/SemseDigitalTwin2D.tsx`.
- `apps/web/components/semse/digital-twin/SemseDigitalTwinScene.ts`.
- `apps/web/lib/digital-twin/layout.ts`.
- `apps/web/next.config.ts`.
- `tests/e2e-semse/semse-digital-twin.spec.ts`.
- `tests/unit/semse-digital-twin-layout.test.ts`.
- `tests/unit/semse-digital-twin-security.test.ts` (nuevo).
- `docs/specs/ui/ecosystem-digital-twin-3d.tasks.md`.
- `docs/reportes/2026-11-16_digital-twin-pr-review-fixes.md` (este reporte).

No se incluyen dependencias, builds, capturas, `.env`, secretos, pipelines, cambios de Railway, esquema Prisma ni migraciones.

## Evidencia de validación

Entorno local: Node `22.23.5`, pnpm `10.33.0`, Next.js `15.5.28` y Chromium real.

```text
Unitarios dirigidos del gemelo digital                PASS — 17/17
TypeScript estricto de apps/web                       PASS
ESLint de apps/web                                    PASS — 0 errores; 39 advertencias fuera del delta
Build completo de Next.js                             PASS — 422 páginas estáticas
TypeScript y build Vite de preview estática           PASS — 1.758 módulos
E2E públicos de preview estática                      PASS — 11/11, sin reintentos verdes
E2E contra el build Next.js                           PASS — 12/12 en 51,4 s, sin reintentos
Unitarios globales del primer delta                   PASS — 1.736 verdes, 0 fallos, 6 omitidos, 11 TODO
spec:validate:strict                                  PASS — 219 specs, 0 errores, 0 advertencias
spec:audit-plan-coverage                              PASS — 181/181, 0 ausentes, 0 extra
spec:index:check                                      PASS — 219 specs indexadas
Pruebas de contratos SDD                              PASS — 29/29
spec:preflight                                        PASS
Build API y generación de cliente Prisma              PASS
verify:workspace                                      PASS — 4.016 verdes, 0 fallos, 42 omitidas en API
```

La regresión de cambio de vista fue roja antes del arreglo por una aserción de producto, no por entorno: tras 1,9 segundos de playback, SMIL sólo registraba `0,13330000638961792` segundos. Tras la corrección pasó de forma aislada y dentro de ambas suites. Una comprobación intermedia detectó que fijar el reloj SVG a un tiempo absoluto rompía el inicio tardío; la versión final avanza desde el reloj actual y ambos E2E temporales pasan juntos.

La suite Next.js incluye el escenario admin autenticado: composición del fixture controlado, 33/33 módulos visibles a `375×812`, selección de BuildOps, madurez `73/100` etiquetada como registro estático, salud runtime ausente, módulo desconocido visible y conservación del mapa ante un 403 controlado.

También se inspeccionaron capturas desktop, móvil y 2D. Se comprobaron geométricamente 33/33 centros visibles en viewports de `333×560`, `285×560`, `620×480` y `1440×900`. En el build normal, las respuestas reales del mapa público y `/admin/consciousness` conservan `Content-Security-Policy: frame-ancestors 'none'` y `X-Frame-Options: DENY`.

### Incidencias de ejecución distinguidas de regresiones

- La primera suite global se lanzó antes de generar `apps/api/dist` y el cliente Prisma, y sin la estructura documental outer que esperan algunas pruebas. Tras preparar esos artefactos sin modificar su código, la repetición terminó con cero fallos.
- El primer E2E admin del build de producción no tenía secreto explícito y fue redirigido al login, comportamiento esperado. Se repitió con `local-digital-twin-test-only` en servidor y firmante; la suite del primer delta terminó 11/11 y la ronda adicional terminó 12/12.
- La primera verificación integral interactiva superó el límite de diez minutos durante los unitarios de API y recibió `SIGTERM`; no terminó con una aserción fallida. Se relanzó con la estructura outer necesaria y terminó con código 0: 4.058 pruebas contabilizadas, 4.016 verdes, 0 fallos y 42 omitidas.

## Checklist final

- [x] Doce hilos reproducidos y cubiertos por regresiones.
- [x] Correcciones limitadas al incremento aprobado.
- [x] Layout determinista y 528 pares comprobados.
- [x] 3D, 2D, lista, reduced motion, fallback y flujos finitos verificados.
- [x] Reanudación 3D→2D e inicio SMIL tardío verificados juntos.
- [x] Admin autenticado y móvil verificados contra Next.js compilado.
- [x] Sin datos runtime inventados ni fixture presentado como producción.
- [x] Sin secretos, cambios Prisma, Railway o pipelines en el delta.
- [x] CI remoto del primer delta `9734db95…` verde; no se reutiliza para el nuevo head.
- [x] Once respuestas iniciales publicadas en el PR.
- [ ] CI remoto del head que incluye la reanudación 3D→2D.
- [ ] Respuesta al hilo `4581903499` después de subir y verificar el commit.
- [ ] Merge y deploy, no autorizados.

## Estados y siguientes pasos

```yaml
merge: UNMERGED
deploy: NOT_DEPLOYED
activation: INACTIVE
migration: NOT_APPLICABLE
production_evidence: []
remote_ci_new_head: PENDING
```

Subir un único delta revisado, comprobar que el CI del commit de integración del PR termina correctamente, actualizar el PR #1157 y responder las observaciones con la evidencia correspondiente. No se resolverán conversaciones, fusionará el PR ni se desplegará sin la confirmación explícita requerida.
