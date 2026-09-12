---
id: "ui.mobile-product-consolidation"
title: "Consolidación del producto SEMSE móvil"
domain: "ui"
sdd_version: "2.0"
version: "1.0"
status: "APPROVED"
owner: "semse-core"
risk: "high"
code_status: "IN_PROGRESS"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags: []
production_evidence: []
related_files:
  - apps/mobile/src/api/client.ts
  - apps/mobile/src/context/AuthContext.tsx
  - apps/mobile/src/config/environment.ts
related_tests:
  - apps/mobile/src/api/client.test.ts
  - apps/mobile/src/config/environment.test.ts
related_endpoints:
  - POST /v1/auth/login
  - POST /v1/auth/refresh
  - POST /v1/auth/logout
  - GET /v1/auth/me
related_events: []
related_agents: []
last_verified: "2026-09-06"
---

# Consolidación del producto SEMSE móvil

## 1. Problema y resultado

SEMSE es un solo producto. Sus copias locales y compilaciones acumularon avances diferentes en navegación, autenticación, temporizador y Prometeo. El propietario autoriza en esta sesión consolidar, configurar, alinear y completar código y documentación, con prohibición expresa de borrar archivos o perder trabajo.

El destino de integración es `apps/mobile` dentro del monorepo, compartiendo contratos con `apps/api` y `apps/web`. La rama de integración parte de `origin/main@88171003`; las carpetas de origen se conservan. No se declara ningún origen obsoleto por su nombre ni se cambia la aplicación publicada basándose solo en su versión.

## 2. Alcance

Incluye inventario verificable de fuentes, configuración única compatible con las dos variables públicas existentes, autenticación robusta, navegación de las capacidades recuperadas, adaptación de contratos, tratamiento de Expo Go, pruebas y documentación de entrega.

Los cambios de reglas financieras, permisos de negocio o estados de dominio no se deducen de una diferencia de interfaz. Se conserva la autoridad del backend y los contratos existentes. La incorporación de sesiones en vivo debe conservar su spec, modelos, migraciones y aislamiento antes de activarse.

## 3. Actores, permisos y límites

CLIENT, PRO, WORKER y OPS_ADMIN se resuelven con `GET /v1/auth/me`. El móvil no inventa tenant, organización ni roles ni los envía como cabeceras de autoridad. Toda solicitud privada lleva el token de la sesión. La navegación no sustituye RBAC del servidor.

`privacyCritical`: tokens e identidad se mantienen en SecureStore; no se incluyen secretos en Expo, documentos o logs. `auditLog`: se conservan los eventos existentes del backend para las acciones de dominio. `sse`: se conserva el contexto autenticado y se cierra al salir. `fsmTransicion`: no se crean transiciones de negocio desde el cliente. `paymentGovernance`: no se modifican liberaciones ni adjudicaciones financieras.

## 4. Escenarios y aceptación

1. Una instalación nueva conecta por defecto a `https://api.semseproject.com`; admite el nombre de variable histórico de ambas copias. Si dos variables discrepan, explica el conflicto y no elige silenciosamente un backend.
2. Las URLs aceptadas son orígenes HTTP(S) sin credenciales, query ni fragmento; se normalizan barras finales y el sufijo `/v1`. HTTP se permite únicamente para desarrollo local. No se adjuntan tokens a URLs absolutas recibidas como rutas.
3. Login y restauración obtienen identidad del servidor. Las solicitudes concurrentes con token vencido comparten una sola renovación. Un logout durante la renovación no restaura la sesión anterior.
4. Una caída de red o un 5xx al renovar no borra las credenciales. Un refresh rechazado por autenticación invalida la sesión y vuelve al login. Las solicitudes terminan por timeout y muestran errores legibles.
5. Logout intenta revocar la sesión en el servidor y termina localmente incluso si la API no responde. Las tareas de ubicación y notificaciones se desacoplan de la sesión terminada.
6. Todos los roles mantienen sus pantallas existentes. Las funciones consolidadas tienen estados de carga, vacío, error y reintento; no usan datos simulados en la interfaz normal.
7. Expo Go carga las funciones compatibles sin importar módulos nativos no disponibles. Videollamadas y ubicación en segundo plano se prueban en builds nativos y se explican como capacidades no disponibles cuando corresponda.
8. Cada fuente y build queda asociado a su identificador, hash o limitación observable. Ninguna carpeta se elimina; ningún cambio local se pisa.

## 5. Contratos

Se conserva el envelope `{ requestId, data }` / `{ requestId, error }` de la API. Los tipos compartidos de `@semse/schemas` prevalecen sobre los tipos locales recuperados. Errores 401, 403, 404, 409 y 5xx permanecen distinguibles. El cliente no convierte un rechazo del backend en éxito local.

## 6. FSM y eventos

La sesión de UI pasa por restauración, autenticada y no autenticada; no modifica FSM de jobs, hitos, pagos ni disputas. La caducidad local se comunica al AuthProvider. No se añaden eventos de dominio por navegación. Los datos locales pendientes requieren scope por usuario/tenant y confirmación antes de considerarlos sincronizados.

## 7. Datos y migración

El endurecimiento del cliente no requiere migración. Cualquier recuperación de modelos de sesiones en vivo se registra en su propio contrato y SQL aditivo antes del despliegue. No ejecutar migraciones de producción durante la consolidación local. Rollback: publicar nuevamente la revisión anterior conservando fuentes, identificadores y datos.

## 8. Calidad y entrega

La aspiración «AAAA» se traduce en criterios verificables: un origen de código, conexiones consistentes, seguridad de sesión y permisos, navegación accesible, errores recuperables, ausencia de crashes en recorridos críticos, pruebas verdes, builds trazables y validación real en iOS/Android. No es una certificación ni se declara alcanzada por compilar.

Canary: login, trabajos, temporizador, evidencia, notificaciones y Prometeo con usuarios autorizados de cada rol; cambio de cuenta, red interrumpida, permisos denegados y regreso del segundo plano. CI, merge, build, instalación y canary se registran separados. No publicar una versión que falle estos gates.

## 9. Tests requeridos

- URL histórica/canónica, conflicto, origen inválido y normalización.
- Refresh concurrente, timeout, 401, 403, 5xx, logout durante refresh y error envelope.
- Estados de sesión y navegación por rol.
- Adaptadores de las funciones recuperadas contra contratos reales.
- Exportación Metro para iOS y Android, TypeScript, suite móvil y validación SDD.
- Canary en dispositivos y entrega EAS desde una misma revisión.

## 10. Implementación y fuentes

Ver `mobile-product-consolidation.plan.md`, `mobile-product-consolidation.tasks.md`, `mobile-product-consolidation.analyze.md`, `mobile-product-consolidation.checklist.md` y `docs/consolidation/MOBILE_SOURCE_REGISTER.md`.

## 11. Investigación externa

- Expo SDK 57: https://docs.expo.dev/versions/v57.0.0/
- Desarrollo nativo: https://docs.expo.dev/develop/development-builds/introduction/
- Almacenamiento de sesión: https://docs.expo.dev/versions/v57.0.0/sdk/securestore/

Se usan contratos de la versión instalada y se separa la experiencia Expo Go de las capacidades nativas; no se añade otro backend.

## 12. Gates de cierre

- [ ] Implementación y regresiones verificadas.
- [ ] Índice y validación SDD verdes.
- [ ] CI y revisión de integración.
- [ ] Misma revisión compilada para iOS y Android.
- [ ] Validación autenticada en dispositivos y Expo Go.
- [ ] Evidencia de publicación y operación separada de los resultados locales.
