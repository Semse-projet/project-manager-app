# Reporte — Auditoría de higiene de las 8 apps del workspace

**Fecha:** 2026-07-26
**Repositorio:** Semse-projet/project-manager-app
**Origen:** continuación del mantenimiento de `apps/assistant-portal`; se aplicó la misma vara al resto de `apps/*`
**Autor:** Claude Code

## Criterio

Se revisó cada app de `apps/*` contra el stack documentado en `CLAUDE.md` (NestJS API, Next.js web, vision-service en Python, Prisma/Postgres, workspaces pnpm) buscando el mismo patrón que apareció en `assistant-portal`: **andamiaje de proyecto suelto que sobrevivió a la absorción en el monorepo**, y apps que rotan sin que nadie las construya ni las verifique.

## Estado de las 8 apps

| App | Desplegada | Estado | Acción |
|---|---|---|---|
| `api` | ✅ semse-API | Sana | — |
| `web` | ✅ semse-web | Sana | — |
| `worker` | ✅ semse-worker | Sana (`.mjs` + `check` con `node --check`) | — |
| `vision-service` | ✅ semse-vision | Python, sin `package.json` — correcto por diseño | — |
| `assistant-portal` | ❌ | Typecheck roto + andamiaje suelto | Corregido aparte, ver `2026-07-26_mantenimiento_assistant_portal.md` |
| `angular` | ❌ | **Compila bien** (47 archivos, bundle en ~17 s), pero con 2 defectos | **Corregido aquí** |
| `autonomy-server` | ❌ | Sana y mínima, pero sin script de verificación | **Corregido aquí** |
| `mobile` | ❌ | **Código muerto que no puede compilar** | **Requiere decisión — no se tocó** |

## Corregido en este PR

### `apps/angular`

1. **`packageManager: npm@10.9.8`** — declaraba **npm** dentro de un workspace **pnpm**. Es el mismo patrón que `assistant-portal` (que declaraba otra versión de pnpm), pero peor: si alguien hace `cd apps/angular && npm install`, corepack le obedece y genera un `package-lock.json` y un `node_modules` paralelo que compite con el del workspace. Eliminado.
2. **Script `"test": "ng test"` que siempre falla.** `angular.json` solo define los targets `build` y `serve` — no hay `test`. Verificado: `pnpm --filter @semse/angular test` devuelve `Cannot determine project or target for command` y exit 1. Un script de test permanentemente roto es peor que no tenerlo: cualquier `pnpm -r test` futuro fallaría sin motivo real. Eliminado.

> **Gap real que queda anotado:** `apps/angular` tiene **47 archivos fuente y cero tests**. Montar su suite es una decisión de producto, no mantenimiento, así que no entra aquí.

### `apps/autonomy-server`

App sana y mínima (`src/server.mjs`, dependencias `workspace:*` correctas), pero **no tenía forma de verificarse**. Se añadió `"check": "node --check src/server.mjs"`, exactamente la convención que ya usa `@semse/worker`, que es la otra app `.mjs` del repo.

## Requiere decisión: `apps/mobile` es código muerto

**No se tocó** porque borrar una app entera es decisión del dueño del producto, no una tarea de mantenimiento. Pero la evidencia de que no funciona es concluyente:

- **No tiene `package.json`.** Como `pnpm-workspace.yaml` incluye `apps/*` por glob, pnpm simplemente la ignora: no es un miembro del workspace.
- **No tiene `tsconfig.json`.** Nada la typechequea.
- **Importa dependencias que no existen en el monorepo:** `react-native`, `expo-image-picker`, `expo-local-authentication`, `expo-notifications`, `expo-secure-store`, `@react-native-async-storage/async-storage`, `@react-native-community/netinfo`, `@react-navigation/native`, `@react-navigation/bottom-tabs`, `@react-navigation/native-stack`, `zustand`. Ninguna está instalada. **No puede compilar.**
- **Sus 2 archivos de test nunca se ejecutan.** El `test:unit` de la raíz corre `tests/unit/*`, y el de la API corre `apps/api/test/*`; `apps/mobile/test/*` no lo recoge ningún runner.
- Son 9 archivos en total (3 pantallas, navegación, 3 servicios, 2 tests) y **solo se la referencia en documentación** (`docs/specs/satellites/SAT-003-mobile-app-client.spec.md`, `docs/architecture/CURRENT_ARCHITECTURE.md`, `docs/SEMSE_CONTEXT.md`, `docs/CODE_REVIEW_FINAL.md`) — nunca en configuración de build.

Es un *spike* de React Native/Expo que se commiteó y se abandonó. **El riesgo de dejarlo no es técnico sino de lectura:** la documentación de arquitectura lo cita como si fuera un cliente móvil existente, cuando no arranca.

Las tres salidas razonables:

1. **Borrarlo** y actualizar las 4 referencias en docs para que digan "planeado", no "existente". Es lo que recomiendo: el historial de git lo conserva si algún día se retoma.
2. **Convertirlo en app real**: `package.json` con Expo, `tsconfig.json`, entrar al workspace y a CI. Es trabajo de producto, no de mantenimiento.
3. **Moverlo a `spikes/` o `docs/prototypes/`**, fuera de `apps/*`, para que deje de parecer una app desplegable.

## Validación

| Verificación | Resultado |
|---|---|
| `build` de `apps/angular` tras quitar `packageManager` | ✅ `Application bundle generation complete` (6.5 s) |
| `check` de `apps/autonomy-server` | ✅ `node --check` pasa |
| `tsc --noEmit` de `apps/api` | ✅ sin errores |
| `tsc --noEmit` de `apps/web` | ✅ sin errores |

Este PR **no toca el `package.json` de la raíz** a propósito: ese archivo ya es zona de conflicto entre los PRs abiertos (#435 y #436 añaden entradas a `pnpm.overrides`). Todos los cambios son de `package.json` de app, así que este PR debería mergear sin conflictos independientemente del orden.
