# Prometeo #974 — expediente para revisión independiente, SDD, ADR-046 y compartición

**Fecha:** 2026-11-01 America/New_York. **Clasificación:** expediente de revisión, sin dictamen emitido. **Estado de liberación:** `HOLD / NO-GO` para nuevas comparticiones entre organizaciones. **Alcance:** seguridad del camino PR #987/#1078, SDD `prometeo.document-sharing-grants`, ADR-046 y dependencias de #992.

## A. Separación de tres autorizaciones

1. **Aprobación de arquitectura:** el SDD pasa de `REVIEW` a `APPROVED` y ADR-046 de `Proposed` a `Accepted` **sólo** tras el dictamen/revisión aplicable, aprobación del propietario vinculada al SHA final, CI y registro de alcance/risks. El consentimiento funcional previo del propietario ya existe; **no repetir** la decisión de producto como sustituto del dictamen.
2. **Autorización de documentos:** cada aportante/titular legítimo consiente una **versión derivada**, audiencia y propósito concretos; ninguna firma general, etiqueta histórica, autorización de código o permiso de organización reemplaza su consentimiento.
3. **Activación:** nivel 3 de [DEC-PLATFORM-001](../architecture/DEC-PLATFORM-001-solo-maintainer-review.md) exige **revisión humana externa real**, canario de allowlist y rollback demostrado. Aprobar documentación **no** activa `SEMSE_PROMETEO_DOCUMENT_SHARING_ENABLED` ni `SEMSE_CURATED_KNOWLEDGE_ENABLED`; la activación necesita un cambio operacional separado y autorizado.

## B. Material verificable entregado al revisor

- [PR #987](https://github.com/Semse-projet/project-manager-app/pull/987): código fusionado de grant/revoke, SQL de tenant/org/proyecto, aislamiento, rutas RAG, límites del modelo privado y tests PostgreSQL. Verificar rama `main` y SHA exacto que se pretenda activar, no asumir que los resultados antiguos se trasladan a otro commit.
- [PR #1078](https://github.com/Semse-projet/project-manager-app/pull/1078): auditor agregado PostgreSQL de sólo lectura, pruebas sintéticas con migraciones completas; [inventario productivo registrado sin exponer datos](https://github.com/Semse-projet/project-manager-app/issues/974#issuecomment-6568809077), `HOLD_CLASSIFICATION`.
- [SDD grants](../specs/prometeo/document-sharing-grants.spec.md) y [ADR-046](../architecture/ADR-046-prometeo-document-grants-private-model-routing.md): estado vigente REVIEW/Proposed; FK compuesta `(documentId, tenantId, projectId)`, `ON UPDATE RESTRICT`, SQL bajo ResourceScope y enrutamiento local-only. Documentar explícitamente el trade-off de imposibilidad de reasociar documentos con grants sin operación gobernada.
- [#974 expediente técnico](https://github.com/Semse-projet/project-manager-app/issues/974#issuecomment-6568829614): CI, staging y rollback aislados reportados; **no** constituye firma externa ni autorización productiva.
- [#992](https://github.com/Semse-projet/project-manager-app/issues/992), [F0 #1008](https://github.com/Semse-projet/project-manager-app/pull/1008) y [F1A #1010](https://github.com/Semse-projet/project-manager-app/pull/1010): son otra ruta. No transformar un `PrometeoDocumentGrant` ligado a proyecto en permiso de biblioteca curada. Matriz `L01…L18` de cuarentena sigue requiriendo ejecución, no basta su redacción.
- [Protocolo histórico](2026-11-01_prometeo-legacy-consent-operational-protocol.md): titularidad, consentimiento real, revisión por versión, retirada y protección de originales.

## C. Pruebas mínimas que debe reproducir o validar la revisión

| ID | Riesgo / prueba | Aceptación exigida |
|---|---|---|
| SEC-01 | Actor firmado / membresía y permisos alterados o revocados | DENY; tenant y org nunca se toman del body |
| SEC-02 | Org B mismo tenant, sin grant de proyecto | 0 título, count, chunk, snippet, embedding, cita, estadística, feedback o documento |
| SEC-03 | Tenant C usa ID conocido de tenant A | 404 neutro, sin metadatos ni efectos |
| SEC-04 | Grant exacto Org A → Org B, ambos participantes del mismo proyecto vivo | Solo lectura autorizada y auditada; no delete, edits, feedback de owner ni project remapping |
| SEC-05 | Proyecto/job eliminado, miembro retirado, grant revocado, flag OFF | Consulta nueva deniega; revocación por owner mantiene ruta operativa aun con flag OFF |
| SEC-06 | Legacy `public_training`, `PROMOTED`, sin `projectId` | Nunca otorgan permiso; cuarentena/ACL probada en TODOS los lectores originales |
| SEC-07 | SQL pagination, direct chunk ID, trade-guide, search, RAG, citas y caches | Mismo predicado de ACL antes de exposición; no inferencia por counts |
| SEC-08 | Grant/revoke concurrentes y error de AuditLog/outbox | Atomicidad; fallo no deja permiso activo ni retirada revertida |
| SEC-09 | Composite FK y cambio de `tenantId/projectId` | PostgreSQL bloquea referencias cruzadas y reasociación silenciosa |
| SEC-10 | Ollama, embeddings y tool fallback con cloud configurado | Cero salida de **datos privados** en captura de red acotada; degradación local segura |
| SEC-11 | F1B consent y withdraw, version/policy/audience hash, titular legítimo | No registrar consentimiento de otro; retiro y expiración bloquean lectura sin worker |
| SEC-12 | Replays/outbox, cache y rol antiguo | No resucitan publicaciones o chunks tras retirada |
| SEC-13 | Rollback sobre DB expandida y checkpoint post-P0 | No volver a binario pre-P0, no down-migrate destructiva, revocación y audit preservados |
| SEC-14 | Sesiones sintéticas reales en staging aislado A/B mismo tenant y C otro | Positivos y negativos, allowlist y rollback con evidencia de SHA/entorno/fecha |

**Muestras:** sólo datos sintéticos. No se exige al auditor ver originales reales para acreditar los casos negativos. No copiar evidencia privada a GitHub. Capturas de egress cubren ventanas concretas; jamás certificar ausencia universal de tráfico por una captura limitada.

## D. Matriz formal de decisión

| Decisión | Requisito objetivo | Estado a la fecha |
|---|---|---|
| D1 — SDD `prometeo.document-sharing-grants` | Aprobación del propietario para SHA final + revisión y controles DEC nivel 1; decidir alcance de grants por proyecto | `REVIEW`, no mover automáticamente |
| D2 — ADR-046 | Aceptar límite RBAC + ResourceScope + grant, FK, no-cloud, salida por rollback | `Proposed`, no aceptación atribuida |
| D3 — Derechos históricos | Fuentes sin consentimiento privadas, obtención individual + versión depurada, revisión de privacidad y oficio | `HOLD_CLASSIFICATION`, #992 OPEN |
| D4 — Auditoría independiente | Revisor humano externo identificable e independiente, informe firmado, SHA, riesgos y reproducción | PENDIENTE, persona no asignada |
| D5 — Compartición por proyecto | Después de D1/D2/D4 + CI/canary/rollback; solo documentos propios de proyecto vivo y org participante | DESACTIVADA / NO-GO |
| D6 — Biblioteca técnica curada | Después de F1B/F2/F3, consentimientos de aportante y titular, 2 revisores humanos por versión y nivel 3 | NO IMPLEMENTADA / NO-GO |

**Distinción clave:** D5 no puede usarse para los históricos sin proyecto; D6 no implica acceso a originales. Un dictamen D4 favorable **no crea** consentimientos D3 ni habilita D5/D6 sin sus propias evidencias.

## E. Formato obligatorio del dictamen humano externo (no rellenar en nombre del revisor)

- Nombre y afiliación profesional de la persona revisora: **PENDIENTE**
- Independencia respecto de autoría/cuentas propias/conflicto: **PENDIENTE**
- Fecha, firma o atestación autenticada, SHA(s) y alcance exacto: **PENDIENTE**
- Casos SEC-01…SEC-14: PASS/FAIL/NO_EJECUTADO con enlaces a evidencias y límites: **PENDIENTE**
- Hallazgos P0/P1/P2, responsables, mitigaciones y riesgo residual aceptado por autoridad competente: **PENDIENTE**
- Dictamen: **HOLD** hasta evidencia real; decisión final humana `APPROVE | HOLD | REJECT`: **SIN EMITIR**
- Referencias a PR/issue y aprobación separada del propietario con SHA y fecha: **PENDIENTE**

El informe puede adjuntarse a [#974](https://github.com/Semse-projet/project-manager-app/issues/974). Una revisión automatizada nunca firma esta sección y una cuenta secundaria del propietario no cuenta como independiente.

## F. Orden de activación autorizado, por carriles

**Carril 1 — grants privados de proyectos nuevos:** confirmar D1 y D2 en documento, D4 y SEC-01…14 según riesgo; CI del SHA exacto; staging aislado con cuentas sintéticas; revisión y prueba operacional de rollback; autorización explícita del owner para allowlist y valor `true` del flag. Primera prueba es un único proyecto/organizaciones ficticias. Revertir flag a OFF ante cualquier fuga o estado desconocido; mantener DELETE/revoke activo, preservar DB/auditoría. No admitir wildcard de tenant.

**Carril 2 — históricos y Biblioteca Técnica:** primero H1/H2 privados; después aprobar F0, fusionar F1A con seguridad y migración autorizadas, implementar F1B de consentimientos y retiro, F2 de revisión/publicación y F3 de consultas con ACL; entonces D3/D4/D6 y un canario **de fichas derivadas**. `TENANT_CURATED` requiere organizaciones autorizadas del mismo tenant, no todas por defecto. **Nunca habilitar compartición de originales** para satisfacer el carril 2.

**Stop conditions:** cualquier leak de contenido o existencia, ausencia de titular/consentimiento, auditoría incompleta, cloud egress privado, cache que resucita un retiro, falta de revisor externo o falta de rollback demostrado => `NO-GO`. Documentar incidentes sin datos personales. No modificar flags ni producción como parte de este expediente.

## G. Responsables y siguiente evidencia

- **Propietario SEMSE:** ya decidió el alcance de producto F1. Falta su aprobación **formal de seguridad/arquitectura por SHA**, sólo después de evaluación, y autorización operativa específica de activación.
- **Revisor seguridad externo:** **sin designación comprobada**. Para empezar necesita acceso mínimo al repo y fixtures sintéticos; entregar este expediente y exigir informe SEC-01…14, no una aprobación genérica.
- **Responsable privacidad/derechos:** **sin dictamen comprobado**. Debe validar quién firma, representación, derechos, licencia, atribución, retención y legal hold de históricos.
- **Revisores de contenido F2:** dos personas humanas independientes por **versión**, privacidad y competencia del oficio; no los sustituye el auditor del diseño.
- **Equipo ingeniería:** ejecutar pruebas L01…L18, reconciliar código F1B con #1008/#1010, CI y staging. Registrar SHA, checks, deployment, SQL y rollback antes de solicitar cambio de estado.

**Conclusión no aprobatoria:** expedientes y contratos listos para revisión; consentimiento histórico, dictamen externo y activación permanecen pendientes. Ningún dato personal, grant, migración ni variable de Railway cambia por estos documentos.
