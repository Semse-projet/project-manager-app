# PR #987 — Diagnóstico Code Quality y revisión de seguridad (2026-10-18)

**Repositorio:** `Semse-projet/project-manager-app` · **Rama:** `integration/p0-prometeo-main-reconcile-20261017`
**Commit examinado:** `c5da3fc017aa68443d3de77d64115d3d99b443cb` · **PR:** https://github.com/Semse-projet/project-manager-app/pull/987
**Tipo:** informe de diagnóstico / documentación. **Estado:** PARTIAL / NOT RELEASE APPROVED.

## Evidencia exacta por commit

- Checks de GitHub del SHA examinado: **8 SUCCESS / 2 FAILURE** después de reintentar el inventario ResourceScope.
- CI central: `quality-gates`, `unit-coverage`, `e2e` PASS en https://github.com/Semse-projet/project-manager-app/actions/runs/39137127993 .
- API Integration PASS en https://github.com/Semse-projet/project-manager-app/actions/runs/39137127984 .
- Hydra aislado, Autonomy Staged, Operación Asistida PASS en el mismo SHA, mediante sus workflows individuales.
- ResourceScope Inventory: primera ejecución terminó antes de ejecutar pasos; **reintento #2 PASS**, con inventario y subida de artefacto completados, en https://github.com/Semse-projet/project-manager-app/actions/runs/39137128017 .
- Code Quality / CodeQL default setup: https://github.com/Semse-projet/project-manager-app/actions/runs/39137124987 , evento `dynamic`: `Analyze (javascript-typescript)` y `Analyze (python)` **FAILURE en ~2 segundos**, `steps: []` y sin `runner_name`. Los intentos individuales y del workflow completo devuelven HTTP 403 indicando que no admiten reejecución. La API de descarga de logs devuelve BlobNotFound. **No se ejecutó un análisis que permita afirmar vulnerabilidad ni ausencia de vulnerabilidades.**
- Contraste: en el mismo repositorio, la ejecución Code Quality del PR #1003 (https://github.com/Semse-projet/project-manager-app/actions/runs/39144385594) completó ambas lenguas con `SUCCESS`, pasos reales y runners asignados; los trabajos Code Quality del PR #1001 también alcanzaron pasos. La causa de los fallos de arranque del #987 sigue **UNKNOWN**, no se ha demostrado que sea facturación, sintaxis o código vulnerable.

Este commit documental ofrece un nuevo HEAD para activar verificaciones normales sobre el mismo código. **Los resultados del HEAD nuevo no se heredan del anterior**; verificar CodeQL y todos los checks antes de cambiar el estado del PR.

## Seguimiento de las 19 conversaciones Codex

Revisión realizada en las 19 conversaciones abiertas del PR, sin marcarlas automáticamente como resueltas y sin atribuir aprobación humana a comentarios automáticos.

### A. Correcciones ya declaradas en rama, pendientes de revalidación independiente
- Reintentos concurrentes de grants (P2002/P2034), rechazo de `projectId` vacío y verificación de grant reubicado a otro proyecto.
- Consulta de grants con predicado acotado para grandes listas de proyectos; se requiere medición SQL real con 20.000 proyectos, además del test de forma.
- Auditoría transaccional de borrado de documentos y cascada de grants; nombre de eventos en catálogo y actor de borrado informado.
- Rutas de PRO con `knowledge:share` y comprobación adicional de ownership.
- Aislamiento OPS_ADMIN de Project Copilot y revisión de evidencia por proyecto autorizado.
- Ollama remoto excluido de `localOnly`; no seguir redirecciones; adapter de tool calls con escaneo de JSON consciente de strings y escapes.
- Embeddings de contenido privado con `localOnly:true` y fallback FTS. Aún falta verificación egress de staging.

**Nota:** que la rama contenga una corrección y que las pruebas normales pasen no constituye revisión independiente ni cierre de hilo.

### B. Decisiones / implementaciones aún pendientes
1. **P1 SDD:** `docs/specs/prometeo/document-sharing-grants.spec.md` permanece `REVIEW`, no `APPROVED`. Sin aprobación formal de security/product owner NO fusionar ni activar el flujo de compartición.
2. **P2 Publicación:** observaciones de campo promovidas por Contributor Program quedan privadas a la org propietaria. No sustituir consentimiento por `public_training` implícito. Falta contrato de publicación con propósito, consentimiento verificable, alcance tenant/org, revocación, auditoría y pruebas cross-org.
3. **P2 RAG de agentes:** los consumidores internos `PrometeoAgent` / BuildOps que no pasan `scope` obtienen respuesta vacía bajo el guard fail-closed. No relajar ese guard: definir propagación de un actor autenticado o contexto de servicio explícitamente autorizado, con casos denegados multi-tenant y de usuario revocado.
4. **Independencia del dictamen:** hilo de 19 observaciones abierto hasta re-revisión verificable; no emitir `APPROVED` en nombre del revisor.
5. **Aceptación aislada:** staging dedicado, prueba de egreso no autorizado, despliegue con rollback, autorización negativa multi-organización, análisis SQL real, migración/consentimiento de datos legacy. El entorno T008 existente no está aprobado para esta verificación.

## Próximas comprobaciones / criterios de cierre
- Examinar los checks de Code Quality del **nuevo HEAD**, distinguir startup (cero pasos) de findings reales.
- Si falla de nuevo antes del primer paso, escalar al responsable de GitHub Code Quality / configuración de la organización con URL + run + timestamps; no desactivar ni sustituir CodeQL por una señal verde artificial.
- Obtener re-revisión de Codex sobre HEAD actual, resolver sólo hallazgos efectivamente verificados y dejar abiertos los de política.
- Obtener SDD formalmente `APPROVED`, revisión de seguridad independiente y staging autorizado antes de merge/deploy/feature flag.
- Mantener issue #974 OPEN y PR #987 DRAFT.

**No se modificaron API, DB, permisos, configuración de Actions, Railway, secretos ni datos de producción para producir este informe.**
