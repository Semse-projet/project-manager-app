# Prometeo — protocolo operativo de consentimiento histórico (#974 / #992)

**Corte:** 2026-11-01 (America/New_York). **Estado:** PROPUESTA DE PROCEDIMIENTO / SIN CONSENTIMIENTOS OTORGADOS POR ESTE DOCUMENTO. **Propietario de datos:** dominio Knowledge / organizaciones y personas titulares de derechos. **Riesgo:** crítico, privacidad y difusión entre organizaciones.

## 1. Hechos y autoridades que no deben confundirse

- PR #987 fusionado: aislamiento de documentos y grants privados **por documento, tenant y proyecto vivo**, con `SEMSE_PROMETEO_DOCUMENT_SHARING_ENABLED` desactivado en producción. Su grant es solo lectura para organizaciones participantes de un proyecto existente; **no** permite compartir un documento histórico sin proyecto.
- PR #1078 fusionado: inventario agregado de producción ejecutado en lectura, registrado en [#974](https://github.com/Semse-projet/project-manager-app/issues/974#issuecomment-6568809077). Clasificación `HOLD_CLASSIFICATION`; no se acredita consentimiento con `public_training`. Los resultados completos y los conteos privados no se copian a GitHub. El inventario **no** es revisión por expediente individual ni prueba de consentimiento.
- En [#992](https://github.com/Semse-projet/project-manager-app/issues/992#issuecomment-6261922298) el propietario **ya ratificó el alcance de producto**: originales privados, `ORG_PRIVATE` por defecto, posibles versiones depuradas `TENANT_CURATED` con opt-in y personas revisoras independientes; no volver a pedir esa decisión.
- [PR #1008](https://github.com/Semse-projet/project-manager-app/pull/1008) contiene el SDD F0, matriz F1-01…F1-25 y contrato de cuarentena L01…L18. Es DRAFT, no fusionado. [PR #1010](https://github.com/Semse-projet/project-manager-app/pull/1010) contiene F1A de custodia privada y datos de consentimiento; es DRAFT, no fusionado, **no implementa** API F1B, consentimientos de personas reales, revisión F2 ni publicación F3.
- El SDD de grants `prometeo.document-sharing-grants` continúa REVIEW, ADR-046 Proposed, y la activación a terceros sigue denegada hasta completar el [expediente de seguridad de #974](https://github.com/Semse-projet/project-manager-app/issues/974#issuecomment-6568829614).

## 2. Tratamiento de cada fuente histórica — sin exposición

1. **Reconciliar en superficie privada:** registrar un identificador opaco de fuente, tenant, organización custodia, origen (`field_observation` u otro), vínculo de procedencia y estado de bloqueo. Sólo operadores con permiso, nunca volcar títulos, `sourceRef`, hashes vinculables, nombres, textos, imágenes, coordenadas ni identificadores a un issue, PR o dashboard público. No añadir tablas paralelas hasta reconciliar el modelo de #1010.
2. **Verificar titularidad:** identificar al aportante humano, la organización/cliente que posee derechos de uso del contenido y si un representante dispone de mandato comprobado y vigente. Si la fuente contiene derechos de más de una persona/empresa, resolver cada titular necesario. `UNKNOWN`, ausencia, fallecimiento de cuenta, renuncia o datos dudosos **NO** se convierten en autorización: mantener privado.
3. **Crear una ficha derivada privada:** redactar desde la fuente sólo bajo permiso; eliminar PII, ubicaciones, rostros, clientes, precios secretos, metadatos de fotos, trazas e identificadores. Conservación del original bajo custodio y ACL propios; no copiar sus chunks a un índice común. El derivado se versiona y se vincula a su procedencia **por referencia privada**.
4. **Mostrar exactamente el objeto de consentimiento:** versión inmutable y vista previa depurada, `contentHash`, `policyHash`, propósito `RAG_REFERENCE`, audiencia `TENANT_CURATED` sólo para organizaciones **autorizadas del mismo tenant**, plazo explícito, atribución optativa, canal de retirada y consecuencias. No fusionar con autorización para entrenar IA, marketing, cesión general de copyright, pagos o licencias profesionales.
5. **Recabar dos autorizaciones diferenciadas:** (a) consentimiento explícito del **aportante real** y (b) autorización del **titular legítimo de derechos/organización**, mediante persona humana autenticada o representante verificado. Cada acto es separado, no preseleccionado ni inferido del silencio, del estado `PROMOTED`, de `public_training`, de un rol admin o de la autorización general del propietario de SEMSE. Una misma persona sólo puede firmar en ambas calidades si la autoridad de ambas se acredita.
6. **Persistir consentimiento auditable sólo cuando F1B exista y esté aprobado:** vincular cada recibo a `tenantId + entryId + versionId + contentHash + policyHash + audience + purpose + noticeVersion + expiresAt + signer/authorityProof`. AuditLog + outbox + revisión monotónica en la **misma transacción**; fallo de autoridad, firma, auditoría o escritura => DENY/rollback. Los justificantes de autoridad permanecen privados y su retención se resuelve por política jurídica, sin inventar plazos.
7. **Revisión por dos personas reales distintas:** privacidad (identificación, consentimiento, derechos, secretos) y competencia técnica por oficio (exactitud, jurisdicción, seguridad, obsolescencia). Ninguna de ellas debe ser aportante, firmante, autor ni publicador de esa versión. Cambiar texto, audiencia o política invalida consentimientos/revisiones previos.
8. **Publicar sólo en F2/F3 autorizadas:** primero decidir `ELIGIBLE` por la política de versión, luego `PUBLISHED` bajo feature flag, allowlist, ACL SQL en la misma consulta de títulos, counts, chunks, RAG y citas. Publicación de fichas derivadas **no utiliza** `PrometeoDocumentGrant` de proyecto, un `projectId` artificial ni un `scope:null` del bus.
9. **Retirada/expiración:** denegar inmediatamente **nuevas lecturas** por predicado SQL; conservar tombstone y auditar retirada. Invalidar caches, índices, snapshots/materializaciones y colas de reintento para que un replay viejo no resucite contenido. No prometer borrar copias previamente descargadas ni alterar originales bajo obligaciones de conservación.

La clasificación operativa durante los pasos anteriores es `HOLD_PRIVATE` salvo que exista evidencia actual de **todos** los requisitos; esto es un estado de seguimiento, **no una nueva FSM persistida**. Reutilizar la FSM y los modelos de #1008/#1010 cuando estén aprobados.

## 3. Texto de consentimiento para revisión jurídica (NO USAR AÚN COMO FORMULARIO ACTIVO)

> Consiento que SEMSE utilice **la versión derivada y depurada que se me muestra** para consultas de referencia técnica mediante RAG por las organizaciones expresamente autorizadas de este tenant. La finalidad es `RAG_REFERENCE`; no autorizo publicar el original, entrenar modelos, compartir con otros tenants, otorgar certificaciones ni generar pagos. He podido revisar la versión, audiencia y fecha de vencimiento indicadas y entiendo cómo retirar mi consentimiento. Esta aceptación **no sustituye** la autorización separada del titular legítimo de derechos.

La pantalla deberá mostrar datos concretos **resueltos en servidor**, no placeholders genéricos: ID de versión, audiencia, finalidad, vencimiento, versión del aviso, política de retención aprobada y vía de retirada. El titular/representante recibirá un texto de autorización **distinto** y con alcance jurídico verificado. Pendiente revisión jurídica de licencia, atribución y plazos; no activar esta plantilla por sí sola.

## 4. Matriz de avance verificable sin datos personales

| Puerta | Evidencia de aceptación | Situación en este corte |
|---|---|---|
| H0. Inventario agregado | Snapshot de auditor #1078, sin compartir datos | EJECUTADO; `HOLD_CLASSIFICATION` |
| H1. Reconciliación histórica | Provenance y titularidad por fuente en custodia privada | PENDIENTE; no inferir del agregado |
| H2. Cuarentena L01–L18 | A/B mismo tenant y C otro tenant, sin fuga de títulos/citas/counts, antes de liberar | NO ACREDITADA por la especificación F0 |
| H3. F1A custodia | #1008 aprobado, #1010 fusionado, DB y staging comprobados | DRAFT / NO DESPLEGADO |
| H4. F1B consentimiento/retirada | F1-01…F1-25, firmas reales autenticadas, audit/outbox, retiro | NO IMPLEMENTADO EN PRODUCCIÓN |
| H5. F2 revisión/publicación | Dos revisores humanos independientes por versión y autorización válida | PENDIENTE |
| H6. F3 RAG compartido | ACL/citas/egress y revocación verificadas; revisión externa de seguridad, canary y rollback | BLOQUEADO |

## 5. Próxima entrega de ingeniería

- **P0:** revalidar L01–L18 frente al código desplegado del PR #987 y a consumidores legacy; inventario agregado sólo prueba características agregadas. Preparar fixtures/sesiones A/B/C en staging aislado y ejecutar pruebas negativas de no divulgación sin datos reales.
- **P1:** terminar decisiones de derechos, licencia, retención y autoridad del representante; incorporar la firma competente al SDD F0 del #1008; luego revisar/autorizar F1A #1010 y desarrollar F1B reutilizando sus tablas, sin duplicar gateway ni consents.
- **P2:** construir UI humana bilingüe de consentimiento y retirada, doble revisión y publicador segregado, sólo en fases aprobadas. Mantener `SEMSE_CURATED_KNOWLEDGE_ENABLED` OFF y document sharing OFF hasta las puertas de nivel 3.

**No realizado por este documento:** contacto con personas, firma de consentimientos, acceso a contenido de producción, backfill, autorización de derechos, cambio de flags, aprobación de SDD/ADR o publicación.
