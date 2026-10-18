# DEC-CI-001 — Disciplina multiagente de CI y presupuesto SEMSE

**Fecha:** 2026-10-18  
**Estado:** PROPOSED / guía SHOULD — requiere revisión humana y CI verde antes de incorporarse a `main`; elevarla a MUST exige decisión aprobada con evidencia de revisión humana.  
**Propietario de decisión:** equipo de plataforma/arquitectura de SEMSEproject; aprobación humana pendiente.  
**Ámbito:** `Semse-projet/project-manager-app`, agentes que consultan `project-manager-app/AGENTS.md`, Claude/Codex y agentes delegados.  
**PR:** [#990](https://github.com/Semse-projet/project-manager-app/pull/990).  

## Problema y evidencia

La auditoría de facturación de SEMSE del 18 de octubre de 2026 identificó presupuesto GitHub Actions **USD 130/130 agotado** en el corte consultado; el usuario comunicó después un aumento a USD 140, no confirmado aquí por consulta de facturación posterior. El repositorio acumuló aproximadamente **29,971.37 runner-minutes Linux**, con **USD 126.77** facturables por Linux, más **USD 3.18** de storage y **USD 0.04** Windows; **USD 26.57** fueron créditos Code Quality por separado. Son cifras históricas de consumo, no nuevas autorizaciones, pagos o facturas.

Las pruebas completas de CI se ejecutan sobre cada revisión de PR elegible; un run típico tenía unos 23–26 minutos sumando jobs, y varios workflows independientes recompilan la API. La cancelación de runs obsoletos de PR ya existe en el CI principal. Las cifras deben verificarse de nuevo antes de cualquier optimización o estimación financiera actual.

## Decisión propuesta

1. **Fuente única:** `project-manager-app/AGENTS.md` declara obligaciones comunes; `project-manager-app/.claude/skills/semse-github-operations-cost-guard/SKILL.md` detalla el proceso. Claude/Codex usan referencias ya existentes, evitando duplicados divergentes. Otros repositorios requieren adopción expresa.
2. **Desarrollo:** agrupar cambios coherentes y ejecutar temprano pruebas locales y específicas, revisión de tipos, contratos, seguridad y tenancy según el cambio. Evitar micro-pushes y reintentos automáticos; inspeccionar workflows que el PR activará.
3. **Bloqueos:** ante `Usage blocked` o `startup_failure`/cero jobs, parar reintentos y declarar `UNVERIFIED`. No confundir bloqueo de billing con error de código.
4. **Gates en dos fases:** antes de merge, exigir checks requeridos completos para la integración temporal del HEAD y base actuales del PR (por defecto `refs/pull/<n>/merge` en los workflows; dejar evidencia del SHA de ambos extremos y del run, sin atribuirlo al HEAD literal), revisión humana para cualquier nuevo `MUST`, y controles SDD, Prisma, unitarios, cobertura, integración/E2E, seguridad y autorización/tenancy según alcance. Después de squash merge, ejecutar CI de `main` y comprobar Railway Deploy, health y procedencia del nuevo SHA desplegado. No exigir el gate post-merge de Railway sobre un SHA PR que aún no fue desplegado. No omitir `main` CI ni protecciones de despliegue.
5. **Autoridad de gasto:** jamás cambiar presupuestos, medios de pago, límites `Stop usage`, secretos o producción sin aprobación puntual y trazable. El gasto Code Quality se controla y reporta por separado de Actions.
6. **Observabilidad:** comparar periodos equivalentes para número de runs, runner-minutes, build duplicados, cancelaciones, fallos y consumo facturable; ningún porcentaje de ahorro se presenta como logrado antes de medirlo.

## Alternativas descartadas

- Subir el presupuesto como respuesta habitual: evita temporalmente el bloqueo, sin eliminar las causas del gasto.
- Deshabilitar E2E, integración, seguridad o gates de `main`: ahorra minutos a costa de riesgos de regresión, privacidad y producción.
- Posponer **todas** las pruebas al final: retrasa detección de fallos y encarece su reparación.
- Duplicar el procedimiento en `CLAUDE.md` y Codex: expone a divergencia entre agentes.

## Límites, riesgos y controles

Esta decisión **no modifica** ningún archivo `.github/workflows/`, branch protection, configuración de GitHub billing, cuenta de pago, servicio Railway ni entorno productivo. Un cambio posterior de workflows requiere un PR técnico separado, pruebas de la integración del PR actual con ambos SHA identificados y medición antes/después. No se garantiza ahorro específico.

La política permanece **PROPOSED/SHOULD (no MUST)** hasta que cumpla la revisión de un revisor humano exigida por `semseproject` §12, la CI obligatoria y la autorización de fusión del propietario. Ningún agente puede elevar unilateralmente una nueva obligación `MUST` a canon. Las revisiones automatizadas de Codex no sustituyen el requisito humano.

## Criterios de aceptación

- [ ] Al menos un revisor humano valida esta decisión y sus controles.
- [ ] La referencia `DEC-CI-001` es visible desde `AGENTS.md` y la skill.
- [ ] Las referencias de Claude y Codex siguen remitiendo a una sola fuente canónica.
- [ ] CI requerido, incluyendo cobertura y E2E cuando aplique, aprobado para la revisión actual (HEAD, base y ref de integración registrados).
- [ ] Ningún cambio en workflows, producción, presupuesto o pagos forma parte de este PR.
- [ ] Estado final reportado por separado: PR, CI, review humana, merge, deploy.

## Anulación o revisión

Una revisión futura de esta decisión requiere nuevo registro/versionado, revisión humana del alcance `MUST`, gates de seguridad y trazabilidad. La falta de presupuesto nunca autoriza bypass de seguridad, cierre de CI falso o merge sin checks.
