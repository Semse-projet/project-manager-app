---
type: plan
feature: "Omniverse Read-Only Projection Adapter"
domain: "prometeo"
spec: "docs/specs/prometeo/omniverse-adapter.spec.md"
version: "2.1"
status: "DRAFT"
branch: "feat/omniverse-adapter"
date: "2026-11-06"
---

# Plan técnico: Omniverse Read-Only Projection Adapter

## Snapshot
Reescrito el 2026-11-06 contra `main` y el spec v1.1. El spec está en `REVIEW`: este plan no autoriza código. Refrescar `main` antes de implementar. **Solo cubre `semse-project-manager-app`**; el repositorio del consumidor queda fuera de este trabajo.

## Constitution check
- [ ] ADR-044 aceptado con fecha y acta aprobada
- [ ] slices 1 a 3 aprobados y fusionados
- [ ] spec `APPROVED` (decisiones de la sección 14 resueltas)
- [ ] identidad de servicio y permisos decididos (Q-1, Q-2)
- [ ] pruebas escritas primero y en rojo, incluida la de cero escrituras
- [ ] sin acceso directo a base de datos, sin escrituras, sin autoridad de negocio
- [ ] CI, merge, despliegue y activación registrados por separado

## Arquitectura
Una capa fina sobre el servicio de consulta del slice 3:
1. **Identidad de servicio** del consumidor, con permiso mínimo de lectura y revocación (Q-1).
2. **Servicio de proyección**: exige `projectId`, consulta el grafo con el alcance de esa identidad y aplica allowlist, techo de sensibilidad y minimización de identificadores.
3. **Endpoint** `POST <prefijo>/omniverse/snapshot` y registro de acceso sin contenido.

## Datos
Sin migración del núcleo. Una tabla nueva para identidades o para el registro de acceso solo si Q-1 o Q-6 lo exigen, con decisión previa.

## Seguridad
- La ruta de lectura no llama a `ensureActorContext` ni escribe nada.
- 404 de otro tenant, 403 de otra organización; `projectId` obligatorio.
- Allowlist publicada, techo `internal` recomendado, sin datos personales ni ubicaciones.
- Exportaciones y denegaciones auditadas sin contenido.
- Kill switch: flag en `off` o identidad revocada.
- No se tocan `CORS_ORIGINS` ni variables de producción.

## Eventos e idempotencia
Solo lectura y determinista; sin eventos de dominio.

## Fases
A. decisiones Q-1 y Q-2; pruebas en rojo → B. identidad de servicio → C. servicio de proyección → D. endpoint y auditoría → E. verificación local → F. PR, CI y merge → G. despliegue, `shadow` y, con las condiciones externas acreditadas, `canary` de una identidad, un proyecto y una organización.

## Rollback
Flag en `off` o revocar la identidad: el acceso se corta sin desplegar. No hay datos que revertir en SEMSE. Los datos ya entregados no se pueden retirar desde aquí (Q-3).

## Gates
- [ ] archivos exactos confirmados contra `main`
- [ ] pruebas primero, incluida integración con base de datos
- [ ] `spec:validate:strict` en verde
- [ ] CI y despliegue terminales
- [ ] evidencia del owner de las condiciones externas antes del `canary`
