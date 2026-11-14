---
type: plan
feature: "Workspace funcional integrado"
domain: "ui"
spec: "docs/specs/ui/workspace-functional-hub.spec.md"
version: "2.0"
status: "APPROVED"
branch: "feat/workspace-functional-20261114"
date: "2026-11-14"
---
# Plan técnico: Workspace funcional integrado

## Snapshot y autorización

Base GitHub `7029da63e719b264f7b2bfaff7eb4b716fe167b9`; código de producción, flags y migraciones no consultados. Autorización expresa del usuario y Blueprint 2026-11-14 para los ocho resultados del spec. No convertir inspección estática en evidencia productiva.

## Constitution check y análisis

La UI reutiliza backend, RBAC, ownership, contratos Zod y navegación existentes. Los paneles consultan solo datos que API autoriza; selección local no otorga acceso. No migración, pagos, nuevas FSM/eventos ni otro backend. Tests antes de código y estados de entrega separados. No gap entre spec/plan/tasks y constitución: la hidratación ahora está autorizada en UI, sin modificar el spec/API del shell ni ampliar programas REVIEW de Prometeo.

## Arquitectura y estructura

Shell conserva Next.js/React/store externo/BFF y variables CSS SEMSE. Tres paneles en escritorio, overlays exclusivos en móvil. `workspace/lib/workspace-model.ts` centraliza labels, roles de presentación y preferencias; paneles de proyectos/evidencia/presupuestos/planificación en archivos separados y queries de dominio disparadas únicamente cuando se necesita ese panel/rol. Funciones de filtrado puras testables por módulo, sin fórmulas de negocio duplicadas. Reutilizar helpers `semse-api`, `buildops-api`, `navigationRegistry` y traducciones existentes.

`workspaceStore.ts` maneja operación pendiente, invalida respuestas tras reset y mantiene `context` coherente con derivados. Prometeo conserva componente/servicios existentes; solo montaje/evento de apertura/actualización contextual donde haga falta. `tests/unit` aloja pruebas derivadas de ocho journeys.

La revisión confirmó que invalidar solo el shell ante 401 no basta para lectores relacionados. `workspace-state.ts` mantiene una generación de scope privada y un estado de sesión no disponible; `use-workspace-query.ts` suscribe todos los lectores, retira datos de la generación anterior y descarta respuestas en vuelo. El contexto Prometeo reutiliza este lector. BuildOps/Prometeo preservan status HTTP en sus errores sin cambiar endpoints, autenticación ni permisos. Reintentar después de 401 primero confirma contexto por el endpoint existente; un 403 por recurso no invalida otras lecturas autorizadas.

## Seguridad y datos

No modificaciones de auth, middleware, permisos, API, Prisma, pipelines ni secretos. Rol desconocido: no solicitudes ni enlaces operativos. El backend sigue validando tenant/organización/recurso. Estimados/ubicación declarados como no verificados. IDs Project/Job/BuildOps no se intercambian. Al seleccionar otra entidad se limpian datos previos y descartan respuestas viejas. Storage guarda solo preferencias de paneles/densidad. Ningún dato financiero se agrega automáticamente al contexto LLM.

## Diseño

Reutilizar colores de marca, superficies, bordes y tipografía actuales. Jerarquía clara con títulos españoles, tarjetas compactas de contexto y estados explícitos. Sin ilustraciones decorativas ni cambio de identidad. Enlaces indican que abren otro módulo; acciones de shell indican su efecto limitado. Controles táctiles de 44 px cuando sea posible, focos visibles y reduced-motion.

## Implementación

Escribir pruebas de modelo/store y contratos UI; desarrollar paneles en paralelo con ownership de archivos exclusivo. Parent integra layout/centro/formulario/store. No registrar datos ficticios ni mostrar contadores inventados; falta de fuente produce empty/error/forbidden. Correcciones puntuales de consumidores cliente/evidencia solo si necesarias para el alcance.

## Entrega

Pruebas enfocadas, typecheck/lint y build web; revisión read-only independiente y fix de defectos comprobados. Reporte con evidencias reales y blockers. Copiar exclusivamente cambios aprobados al checkout original, commit/rama/PR borrador. Sin merge ni deploy productivo. Checkpoint Manus separado de GitHub/producción y sin auto-publicación. Rollback del frontend: revertir commit, sin modificar datos.
