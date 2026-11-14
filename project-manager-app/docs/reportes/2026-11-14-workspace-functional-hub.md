# SEMSE Project — Workspace funcional

**Fecha:** 14 de noviembre de 2026. **Estado:** implementado y comprobado localmente; sin merge, despliegue ni activación. **Rama prevista:** `feat/workspace-functional-20261114`. **Base inspeccionada:** `7029da63e719b264f7b2bfaff7eb4b716fe167b9`.

El usuario aprobó los ocho resultados y su Blueprint antes de implementar. Se conservan el monorepo, Next.js, identidad visual, módulos propietarios, contratos y autorización backend. Este documento captura la evidencia antes de crear el PR; su URL y checks remotos se registran en el handoff del PR, no se presuponen aquí.

## Resultado funcional

| Área | Implementación |
| --- | --- |
| Inicio | Título y tipo de referencia activa, continuación por sección y cierre del contexto sin cancelar trabajo. Formulario de máximo 200 caracteres, preservado ante error y sin envío repetido. Una referencia no se anuncia como Project ni ejecución durable. |
| Navegación | Seis secciones en español, búsqueda local de destinos activos del registro permitidos al rol y regreso por historial existente. Atajos identificados como apertura de otro módulo. |
| Proyectos e hitos | Selector y búsqueda sobre proyectos autorizados, estados canónicos y consulta de hitos mediante el Job vinculado. Project, Job y BuildOps conservan IDs distintos; sin filtros ignorados ni métricas de riesgo o avance inventadas. |
| Evidencia | Selector de trabajos, filtros locales tipo/estado/hito y acceso a flujos reales. Los cargadores usan plan → PUT de bytes del File → registro canónico, en ese orden; errores parciales y archivos fallidos visibles. No hay cargas simuladas. |
| Presupuestos | Accesos por rol y ofertas recibidas del mismo Job para cliente/ops, con importe, plazo, nota y estado. Sin adjudicación ni conversiones. Profesional conserva propuestas propias. |
| Planificación | Consulta BuildOps, filtros proyecto/estado/prioridad, grupos vencidas/próximas/sin fecha, fechas inválidas explícitas y destaque blocked/urgent. No edita fechas ni estados ni inventa vencimientos de hitos. |
| Prometeo | Un acceso explícito desde Inicio reutiliza el widget existente; no se crea otro chat ni se envían presupuestos automáticamente. Aceptar sugerencia abre referencia y refresca el shell incluso en la misma ruta; no ejecuta negocio. |
| Configuración y móvil | Paneles plegables, densidad cómoda/compacta y restauración, con solo preferencias visuales en el navegador. Un diálogo exclusivo, foco inicial/Tab/Escape/restauración, fondo inert y scroll bloqueado, controles táctiles y reduced-motion. |

## Protección de estado y sesión

El store serializa operaciones, coalesce refresh y conserva solo cambios confirmados. Las respuestas viejas se descartan tras reset, cambio de identidad/scope, selección o desmontaje. Las respuestas del shell se validan con los schemas compartidos antes de incorporarse a la UI.

Un **401 confirmado** en un lector de negocio o contexto Prometeo retira el contexto y todas las consultas privadas relacionadas; invalida operaciones y respuestas pendientes y conserva solamente etiquetas de sección hasta confirmar sesión nuevamente. Un **403 por recurso** mantiene las consultas independientes autorizadas. Los errores conservan status HTTP estructurado y mensajes distinguibles, sin convertirse en vacíos exitosos. Esta coordinación es de presentación; no modifica autenticación, roles, ownership ni policy backend.

Las preferencias almacenan únicamente dos booleanos de panel y un enum de densidad. No guardan IDs, referencias, proyectos, archivos, conversaciones ni datos financieros.

## Revisión independiente y correcciones

Una revisión técnica automatizada read-only trazó las ocho conexiones contra los contratos existentes. No fue revisión humana. Confirmó tres defectos y se corrigieron antes de entregar:

1. **401 transversal:** una consulta fallida no retiraba datos de otras consultas. Se agregó invalidación compartida y descarte de respuestas pendientes; incluye Job cargado seguido de bids 401 y contexto Copilot seguido de 401.
2. **Clasificación HTTP:** se perdía status al convertir errores a texto. Se preserva el número en lectores y resultados; los paneles lo usan para clasificar acceso y servicio.
3. **Accesibilidad del buscador:** dos instancias de LeftPanel compartían ID. `useId` genera asociaciones label/input únicas para escritorio y diálogo coexistentes.

Las cinco regresiones iniciales fallaron antes de los fixes; después pasaron seis regresiones de estos casos. Las pruebas ejecutan funciones, store y hooks/componentes reales transpilados con fixtures sintéticos aislados. No registran datos de demo en la aplicación.

## Evidencia local

| Comprobación | Resultado |
| --- | --- |
| Instalación congelada con pnpm 10.33.0 | PASS; sin nuevas dependencias ni cambios de lockfile. Política local de lifecycle en la copia Manus, excluida del PR. |
| `pnpm build:packages` | PASS. |
| Regresión integrada de workspace y consumidores | **155/155 PASS**, cero fallos, cero skips. |
| Typecheck web `tsc --noEmit`, incremental false | PASS; también incluido en el build final de Next.js. |
| Typecheck explícito de nuevas pruebas de sesión/store/BFF | PASS. |
| ESLint de superficies afectadas | Cero errores. Un warning preexistente en recorrido 360 no modificado. |
| `pnpm --filter @semse/web build` después de fixes | **PASS**, salida terminal 0, tipado y generación de páginas completos. |
| `spec:validate --strict` | PASS; 219 specs, cero errores y advertencias. |
| `spec:coverage` e índice generado | Ejecutados; los specs históricos sin tests siguen siendo deuda previa, no cobertura nueva atribuida. |
| Runtime local sin sesión | `/workspace` → 307 a login; login → 200. Manifiesto de 248 rutas HTTP 200 y consistente con el source. |

La regresión incluye nuevos tests de modelo, navegación, store/BFF, cuatro paneles, Prometeo e invalidación de sesión, además de recorridos 360/protección de rutas y regresiones de evidencia, localización, registro de navegación y vista canónica previas.

Los logs completos se conservan en la evidencia de la sesión Manus; no se suben logs de entorno ni credenciales al repositorio. Las comprobaciones anteriores son locales: no equivalen a CI verde ni a pruebas de autorización o almacenamiento con servicios reales.

## Límites concretos

- Los contratos actuales de Job y Bid no informan moneda. Se muestran importes/plazos/notas/estados reales; **la diferencia económica se indica no disponible** sin rango completo y moneda explícita compatible. No se supone USD ni otra divisa.
- Se usa la estrategia de carga existente `single_put`, con máximo de 25 MiB o el límite más estricto del servidor. Se rechazan archivos vacíos, `external_transfer` y estrategias desconocidas con mensaje; no se implementa multipart nuevo.
- No hubo backend local configurado ni sesión de negocio. Faltan journeys con sesiones CLIENT, PRO/WORKER y OPS_ADMIN en un entorno autorizado, ownership efectivo, almacenamiento del proveedor y recuperación de fallos. No se consultó ni modificó producción.
- La interacción visual de foco/viewport debe observarse en navegador/dispositivos reales. Se comprobó el ID duplicado con render y su fix con regresión; no se inventa una validación visual.
- El transporte `.manus/preview-proxy.mjs` y `manus-routes.json` solo habilitan Preview. No forman parte del PR, no crean backend de negocio ni eluden login. La autenticación y cabeceras productivas del repositorio permanecen intactas.
- `pnpm spec:preflight` es el preflight Railway de este repositorio, no la validación SDD. No se ejecutó como gate de producción en esta tarea. Presupuesto GitHub: **UNKNOWN**, lectura de billing respondió 403; no se cambió presupuesto ni se reintentaron workflows.

## Entrega y siguiente gate

Se prepara una sola rama y PR en borrador. El mantenedor conserva revisión humana, comprobaciones CI requeridas, validación autenticada y decisión posterior de merge/despliegue. El checkpoint de Manus es una copia guardada distinta de GitHub main y de producción, con auto-publicación desactivada.

`code_status: COMPLETE`, `merge_status: UNMERGED`, `deploy_status: NOT_DEPLOYED`, `activation_status: INACTIVE` y `production_evidence: []`. `ci_status: NOT_RUN` captura el momento anterior al PR; el estado vivo de sus checks se reporta después en GitHub. No se marca VERIFIED.

Rollback del cambio: revertir el commit frontend autorizado; no modifica backend, contratos, migraciones ni datos de negocio.
