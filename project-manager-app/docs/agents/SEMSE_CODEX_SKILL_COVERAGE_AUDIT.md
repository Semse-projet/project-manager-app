# Auditoría de cobertura de skills SEMSE — Claude / Codex

**Fecha de corte histórico:** 10-oct-2026. **Ampliación propuesta:** 12-oct-2026. **Repositorio:** `Semse-projet/project-manager-app`.

## Alcance y evidencia

- Inventario verificado: 23 directorios con `SKILL.md` canónico bajo `project-manager-app/.claude/skills/`.
- Situación anterior: 2 entradas bajo `.agents/skills/`: `semse-github-operations-cost-guard` y `testing-worker-tracker`.
- Esta entrega incorpora 21 descriptores de descubrimiento para Codex, hasta completar **23/23 por identificador**. Cada descriptor nuevo enlaza al archivo canónico sin copiar sus reglas.
- `testing-worker-tracker` en Codex conserva instrucciones detalladas anteriores. Es una excepción de contenido, no una skill adicional; debe revisarse por posible deriva frente a su par en Claude antes de cambios de comportamiento.
- CI ejecutará `tests/unit/semse-codex-skill-parity.test.mjs` mediante `pnpm test:unit`. Comprueba igualdad de IDs, frontmatter y referencias a autoridad, pero **no** prueba la selección semántica de todos los prompts ni capacidad real de operación en cada cliente.

## Ampliación del programa de 36 flujos — 2026-10-12 (rama en revisión)

- Se prepararon **4 nuevas skills** para gestión de datos sintéticos, E2E por flujo, release en Railway y recuperación de respaldos, cada una con `SKILL.md` canónico y descriptor Codex.
- Candidatas: `semse-synthetic-test-data`, `semse-business-flow-e2e`, `semse-railway-release-verification`, `semse-backup-restore-verification`.
- Inventario **en esta rama**: 27 skills Claude ↔ 27 descriptores Codex por ID; se mantiene la excepción legacy `testing-worker-tracker`.
- `semse-skill-pack-contract.test.mjs` comprueba el contrato mínimo de las cuatro nuevas skills, alcance y rutas. `semse-codex-skill-parity.test.mjs` verifica paridad dinámica global.
- Ninguna skill ejecuta por sí misma seeds, migrations, tests de negocio, restores, merge ni deploy. Revisión/CI/merge son estados separados de haber creado los archivos.
- Diferenciación obligatoria: `SIMULADO_VALIDADO` ≠ `ISOLATED_RESTORE_VERIFIED` ≠ `PRODUCCION_TECNICAMENTE_VERIFICADA` ≠ `PILOTO_REAL_VALIDADO`.
- Verificar tras el PR: `cd project-manager-app && node --test tests/unit/semse-codex-skill-parity.test.mjs tests/unit/semse-skill-pack-contract.test.mjs`; `pnpm skill:route:report`; `pnpm test:unit`; CI requerido antes de merge.
- **Límite:** no afirmar que están instaladas en `main` o en equipos/otras apps hasta que exista merge y se verifique su descubrimiento en ese entorno.

## Kit de calidad SEMSE — 2026-10-20 (rama en revisión)

- Se añaden **4 skills** propias adaptadas del pack externo `replica-skill` (MIT, commit `77c9436`), cada una con `SKILL.md` canónico y descriptor Codex: `semse-recon`, `semse-parity-audit`, `semse-functional-test`, `semse-release-gate`.
- Inventario **en esta rama**: 31 skills Claude ↔ 31 descriptores Codex por ID; se mantiene la excepción legacy `testing-worker-tracker`.
- `semse-kit-contract.test.mjs` comprueba el contrato del kit: frontmatter, delegación en skills existentes, prohibiciones de merge/deploy/pagos, procedencia y licencia del código adaptado, ausencia de imports de red en las herramientas Python y sus 39 tests upstream cuando hay `python3`.
- Las 7 skills restantes del pack (architect, build, backend, deploy, brand, launch y casi todo design) **no** se importaron; motivos en `docs/semse-kit/README.md`.
- Las fases 3–5 del kit (validadores, workflow de Actions, preview de Railway) no forman parte de esta entrega.

## Límites de completitud

**23/23** significa paridad de **skills instaladas en este repositorio**, no que todas las conversaciones, librerías o proyectos externos ya estén integrados. No se importaron a ciegas prompts históricos ni colecciones externas de ECC.

Documentos candidatos identificados previamente y **no contados como skills adicionales**: `SEMSE_SKILL_EXECUTION_PROTOCOL_v1.md` (protocolo), `SEMSE Skill Router & Governance Kit v1` (concepto parcialmente cubierto por `semse-skill-router`), `AAA Zoom + Loop Execution Skill Pack` (ya cubierto por `aaa-zoom-loop-execution`), y material de `SEMSE Repository Completion & AAA Delivery` (requiere comparar alcance y versión con `semseproject` y AAA antes de instalar). La biblioteca ECC contiene propuestas de terceros, no autorizadas automáticamente.

Los dos proyectos de ChatGPT sobre SEMSE deben auditarse por sus archivos concretos antes de afirmar inventario global. La URL histórica del repositorio `Samuelcastella/project-manager-app` redirige al mismo repositorio; no duplicar su recuento.

## Reglas permanentes

1. Mantener autoridad única en `.claude/skills/<id>/SKILL.md` y un descriptor Codex liviano por ID en `.agents/skills/<id>/SKILL.md`.
2. No instalar todas las skills en el contexto de cada tarea; seleccionar por dominio y leer la gobernanza SEMSE primero.
3. Al añadir, renombrar o retirar skills, actualizar ambas raíces, catálogo y prueba de paridad en el mismo PR. Nunca permitir duplicados con reglas divergentes.
4. Conservar `testing-worker-tracker` como excepción legacy hasta una migración revisada. No perder su contenido ni afirmar que es idéntico a Claude.
5. Los cambios de skills no conceden permiso de merge, despliegue, pago, cambios de presupuesto ni saltos de CI. La revisión humana y los gates permanecen obligatorios.

## Verificación

- `cd project-manager-app && node --test tests/unit/semse-codex-skill-parity.test.mjs`
- `cd project-manager-app && pnpm skill:route:report` (router Claude; informe, no autorización)
- `cd project-manager-app && pnpm test:unit` (paridad + regresiones)
- Revisar el CI del SHA del PR antes de cualquier fusión; la ausencia de protección de `main` es un riesgo abierto independiente.
