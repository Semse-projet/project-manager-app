# SEMSE Library Hub — evaluación de overrides del portal

**Estado:** propuesta de gate de compatibilidad aislado, pendiente de CI y revisión independiente. Base: `main`, sin modificar versiones, producción, Railway ni paquetes.

## Hallazgos comprobados

| Paquete | Pin global | Declaración de consumidor | Riesgo y tratamiento |
|---|---|---|---|
| `@types/express` | `4.17.21` | API `^5.0.6` | Conflicto aparente de tipos. Documento `2026-07-26_mantenimiento_assistant_portal.md` explica que fijar 4.x corrigió tipos `Request` incompatibles en portal (Express 4). **Mantener** mientras no haya prueba de migración; API debe seguir pasando su gate existente. |
| `esbuild` | `0.28.1` | portal `^0.28.2` | Pin inferior al mínimo declarado: compilar servidor con el paquete realmente instalado y revisar la motivación del pin en otro PR antes de actualizar. |
| `postcss` | `8.5.23` | portal `^8.5.28` | Pin inferior al mínimo: build Vite/Tailwind + pruebas, revisar razón de seguridad antes de actualizar. |
| `vite` | `7.3.6` | portal `^7.3.6` | Pin compatible con el rango declarado, se prueba igualmente. |

Los cuatro están en `package.json` de la raíz y `pnpm-lock.yaml`. Versiones declaradas vs resueltas no son prueba de CVE ni licencia. Documentación anterior: `2026-07-26_mantenimiento_assistant_portal.md` y `P0_STABILIZATION_AUDIT_2026-07-13.md` (advertencia: overrides anularon bumps directos en el pasado).

## Brecha de validación

`pnpm check:assistant-portal` existe en el monorepo, pero el `quality-gates` principal de `ci.yml` no lo llama. La app se dejó fuera de `railway:preflight` deliberadamente porque no forma parte de API/Web/Worker desplegados. Un CI verde del Library Hub no demuestra por sí mismo compatibilidad del portal.

## Solución limitada a esta PR

El archivo `.github/workflows/assistant-portal-compat.yml` ejecuta una comprobación efímera sólo cuando cambian dependencias pertinentes, el código del portal, este informe/SDD, o a demanda (`workflow_dispatch`). Pasos: registrar pins globales, `pnpm install --frozen-lockfile`, `pnpm check:assistant-portal`, `pnpm build:assistant-portal`. Usa runner GitHub existente y permisos de lectura; no crea servicio ni ejecuta despliegue. El coste operativo es tiempo consumido del runner **sólo durante una corrida**; no estimar facturación antes de observar su duración.

## Decisiones y gates

- **No** retirar `@types/express` 4.x sin demostrar Express 5 + tipado de API/portal.
- **No** cambiar `esbuild` ni `postcss` en este PR: compilar no acredita ausencia de CVE. Registrar asesorías y compatibilidad funcional antes de elegir un nuevo pin, con SDD y PR propios.
- **No** ampliar `railway:preflight`: mantener independencia de portal/no desplegado.
- Gate de seguridad adicional: revisar dependencias con datos de advisories verificables al preparar un upgrade (sin tratar un release nuevo como necesariamente seguro).
- [ ] Workflow pasa sus pasos reales en un PR.
- [ ] CI general no muestra regresiones de SDD/índice.
- [ ] Revisión humana independiente de la justificación y del costo del job.
- [ ] Antes de fusionar, documentar cobertura y duración.
- [ ] Sin merge ni deploy en esta entrega.

## Rollback

Revertir workflow y documentos no altera paquetes ni runtime. No se modifica lockfile o `package.json`. 
