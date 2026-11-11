# ADR-WPI-001 — Registros personales independientes y ámbito organizacional

- **Fecha:** 2026-10-24
- **Estado:** Proposed (NO APPROVED)
- **Programa:** `labor.worker-independence-growth-program`
- **Afecta:** Labor Engine, FreeProject, Identity, Offers, Skills, Evidence, Business Access
- **Riesgo:** critical

## Contexto

Una persona puede registrar tiempo y actividad legítima como trabajador, profesional independiente o participante de varias organizaciones. Integrar una compañía después, cambiar de patrón o convertir un FreeProject a un Job no debe transferir en bloque su historial personal a ninguna organización. El modelo genérico `tenantId` delimita, **pero no autoriza**; FreeProject tiene la excepción aprobada de acceso por `createdBy` y `TimeEntry purpose=personal` es privado por diseño existente.

Existen reglas de autorización empresariales distintas: Job/Org/Membership y Payment Governance. El flujo BO-05 de oferta no es un contrato legal ni una compartición general; BO-12 ya genera constancias redactadas y revocables. Duplicar esos motores introduciría contradicciones.

## Decisión propuesta

1. **Una identidad, capacidades contextuales:** reutilizar `User` multirol. Nunca crear una segunda identidad laboral al entrar a una empresa.
2. **Un motor de tiempo:** Labor Engine/`TimeEntry` es la fuente canónica. Los adaptadores móviles/Field Ops no escriben un segundo estado; ADR-029 permanece vinculante.
3. **Dos ámbitos sin trasvase implícito:**
   - `personal`: autoría individual `createdBy` y restricción tenant; solo el creador lee/escribe salvo procedimiento autorizado explícito.
   - `organizational`: authority por recurso/Org/Job y permisos efectivos de Membership activa. El mismo usuario en dos empresas no hereda privilegios.
4. **Compartición referenciada, no migración de propiedad:** un share aprobado solo expone los campos/medios precisos, con finalidad y destinatario definidos; inventariar grants existentes antes de introducir un modelo nuevo. Nunca `UPDATE` masivo para reasignar `createdBy`, ni lectura histórica retroactiva.
5. **Custodia e integridad:** corregir mediante historial, motivo y revisión. La conservación o eliminación depende de contratos, terceros y ley aplicable; no prometer que un dato sea jurídicamente propiedad exclusiva del autor.
6. **Experiencia portable por resumen:** BO-12 conserva su contrato de atestaciones redactadas, consentimiento, expiración y revocación; las fotos y nombres de clientes nunca se agregan por defecto. No niveles/badges/licencias basados en conteos.
7. **Acuerdo no es firma ni empleo:** BO-05 no registra W-2/1099, no activa contratos Documenso, no concede acceso por aceptar una oferta.
8. **Agentes sin autoridad implícita:** Prometeo puede redactar o recomendar, pero no publicar, compartir, firmar, certificar, fijar tarifas o liberar pagos sin autorización de negocio correspondiente.

## Alternativas rechazadas

- Segunda base de horas personales en paralelo con TimeEntry: dos fuentes canónicas y riesgo de reconciliación/offline.
- Transferir todo el historial de FreeProject al aceptar una invitación: fuga de privacidad y acceso retroactivo.
- Mostrar evidencia de proyectos privados en portafolio público automáticamente: obligaciones de confidencialidad y derechos de terceros.
- Tratar evaluaciones o conteos de trabajo como certificaciones legales: credenciales falsas.
- Usar un `tenantId` común como permiso transversal: BOLA/IDOR y fuga de compensación.

## Consecuencias y condiciones pendientes

- F1 debe inventariar y probar los endpoints de lectura/exportación existentes antes de agregar otros.
- Requerirá matriz por tipo de dato (tiempo personal, notas, GPS, medios, gastos, ofertas, atestaciones), permisos negativos A/B mismo tenant y A/C cross-tenant, retención legal y revocación.
- Referencias cruzadas `docs/foundation/DOMAIN_INVARIANTS.md`, `docs/specs/labor/labor-engine-remediation.spec.md`, `docs/specs/labor/free-project-mutation-guard.spec.md`, `docs/specs/core/universal-identity-multi-role.spec.md`, `docs/specs/core/business-offers.spec.md`, `docs/specs/core/skills.spec.md`.
- Si se aprueba, actualizar invariantes con **excepción personal de alcance**, sin debilitar permisos de Job, Payment/Escrow o Evidence organizacional.
- No introducir esquema, API, feature flags, deploy ni cambios automáticos en el presente PR.

## Validación requerida para aceptar el ADR

Revisión independiente Architecture/Security/Privacy y acuerdo explícito del propietario sobre retención, pruebas de titularidad, revocación, permisos de supervisor y exportación. Las pruebas de regresión y CI se ejecutarán **al final del slice de implementación**, no como sustituto de esta revisión.
