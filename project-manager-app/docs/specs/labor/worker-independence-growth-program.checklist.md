---
type: checklist
feature: "worker-independence-growth-program"
spec: "docs/specs/labor/worker-independence-growth-program.spec.md"
version: "2.0"
date: "2026-10-24"
---

# Checklist de revisión — Worker Independence & Growth

## Contrato del programa

- [x] El programa está en `DRAFT`; ningún cambio funcional autorizado.
- [x] Es explícito que no se implementan F0–F5 en un solo PR.
- [x] Existe contrato de no transferencia automática de historia personal.
- [x] Reutiliza `TimeEntry` y FreeProject, sin segundo sistema.
- [x] Respeta BO-05 sin W-2/1099, sin firma Documenso y compensación privada.
- [x] Respeta BO-12 sin niveles/badges/licencias automáticos.
- [x] No incluye salarios identificables, nombres de empleados/empresas ni material privado de conversación.
- [ ] Aprobación del propietario y revisión independiente de Architecture/Security/Privacy.

## F0 antes de codificar

- [ ] Matriz de actor, propósito, recurso, campo, tipo de dato y retención.
- [ ] Políticas de autoría, propiedad contractual, consentimiento y eliminación documentadas legalmente.
- [ ] Endpoints reales, modelos Prisma, rutas de medios, exportaciones y grants inventariados.
- [ ] Caso sin empresa, multi-org y supervisor con acceso limitado modelados.
- [ ] `ResourceScope`, evento de auditoría y restricciones por `createdBy` preservados.
- [ ] Datos personales de terceros y medios fotografiados en obras privadas cubiertos.
- [ ] Reglas de revocación no prometen retirar copias entregadas ni eliminar legal hold.

## Seguridad y pruebas del primer slice F1

- [ ] A y B mismo tenant (lectura/mutación), C distinto tenant y suspensión.
- [ ] Registro `purpose=personal` ausente en costos, admin, supervisor y reportes organizacionales.
- [ ] Exportación autorizada, limitada, versionada y auditada; sin enumeración ni fuga de attachment.
- [ ] `clientEventId`/offline replay y correcciones sin duplicados.
- [ ] Conversión FreeProject→Job sin cambiar propiedad por implicación.
- [ ] Cobertura de URL firmada, almacenamiento, revocación y retención.
- [ ] Smoke ES/EN autenticado y cambio de idioma sin pérdida de formulario.
- [ ] Matriz negativa de Prometeo: sin share, firma, certificación o pagos sin aprobación.

## Entrega

- [ ] `pnpm spec:index --check` confirma índice generado.
- [ ] Specs del slice aprobadas e indexadas.
- [ ] Tests, revisión seguridad y rollback documentados.
- [ ] CI final terminal, sin inferir producción de un status green.
- [ ] Merge, deploy y activación con autorización independiente y evidencia.

**Estado actual:** no se han realizado pruebas de ejecución para este programa; es documentación de contrato inicial.