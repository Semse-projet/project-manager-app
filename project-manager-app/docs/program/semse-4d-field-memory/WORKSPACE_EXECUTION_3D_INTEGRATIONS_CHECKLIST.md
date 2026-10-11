# SEMSE Workspace — ejecución integral, catálogo de conectores y modelado 3D
**Fecha:** 2026-10-11 · **Estado:** PLAN DE IMPLEMENTACIÓN / NO DESPLEGADO · **Origen:** conversación del fundador, PR #857 y PR #859.
**Producto:** reutilizar SEMSE Workspace, incorporarle acciones reales, el Universal Connector y creación/visualización 3D, conectando modelos con el historial 4D y Evidence. No afirmar que los proveedores están conectados ni que modelado 3D ya esté integrado.
**Enlazado a:** WORKSPACE_REUSE_AND_CONNECTORS.md, MULTI_ORG_CONTEXT_SELECTOR_UX.md, COMPANY_INVITATIONS_DETAILED_SPEC.md y arquitectura Field Memory 4D.

## Documento especializado de recorrido fotorrealista desde fotos
El propietario aclaró un caso distinto al modelado manual de objetos: fotografías que permiten caminar virtualmente por una habitación mediante reconstrucción y renderizado interactivo. Ver [PHOTO_WALKTHROUGH_3D_4D_CAPTURE_SPEC.md](PHOTO_WALKTHROUGH_3D_4D_CAPTURE_SPEC.md) para fotogrametría COLMAP, panoramas, Nerfstudio Gaussian Splatting, acceso temporal anterior a sheetrock y pruebas PWR-01...12. La reconstrucción se procesa antes de la navegación; el render sí puede ser interactivo en tiempo real.

## A. Una decisión imprescindible: modelar no es solo visualizar
Hay 4 capacidades distintas que SEMSE debe señalar explícitamente:
1. **Visualizar/inspeccionar** un objeto 3D existente, girar/medir/aislar; no implica editar diseño fuente.
2. **Crear/editar** mallas u objetos paramétricos y exportar el archivo editable/original. Requiere un motor autor o una aplicación autorizada (no basta un viewer).
3. **BIM constructivo**: leer/importar modelos IFC/Revit con semántica de elementos, sistemas y ubicaciones; las mallas bonitas no sustituyen BIM ni garantizan medidas o cumplimiento.
4. **Memoria 4D**: asociar modelos/versiones/elementos a tareas, fotos y tiempo, para comparar antes/después y reconstruir obra sin inventar una ubicación oculta.

**Ejemplo prioritario para el oficio eléctrico:** generar o importar representación de una caja 4×4, conduit EMT y sus recorridos; indicar dimensiones/unidades y relación con plano/room; propuesta de Prometeo revisada por encargado; guardar fuente 3D + vista GLB + versión + evidencia y estado "PROPOSED/VERIFIED" separado. Las piezas modeladas **no certifican** dimensión física exacta, NEC, UL o montaje real. Sin captura/levantamiento verificados, la posición del cable es solo estimada.

## B. Matriz proveedor/capacidad (candidatos verificados documentalmente, NO integraciones activas)
| Tecnología | Rol viable | Límite crítico | Ruta candidata |
|---|---|---|---|
| **Blender + Python API** | Crear, modificar, renderizar y exportar objetos 3D mediante jobs automatizados o editar en app externa | No es un editor SaaS remoto listo para conectar; requiere ejecución aislada de Blender, plantillas/versiones y control de CPU/GPU, nunca scripts arbitrarios del usuario | Adapter `model.generate.blender`; worker aislado → archivo editable .blend + GLB opcional |
| **Three.js / visor web de SEMSE** | Presentar GLB/glTF, orbit, selección, medidas/controles y anotaciones en el Workspace | Un visor no equivale a CAD/BIM con editor paramétrico; requiere implementación del frontend y pruebas de geometría, unidades y rendimiento | Componente visual `3d-viewer` tras revisar bibliotecas existentes y licencias |
| **That Open / web-ifc** | Importar, leer/editar datos IFC según capacidades de librería, consultar elementos BIM y geometría web | IFC requiere mapas de identidad/revisión, coordenadas, tolerancias y tipos; no promete autoría nativa de Revit | Adaptador de importación IFC validado y vista BIM contextual |
| **Autodesk Platform Services (APS)** | Viewer SDK + Model Derivative para ver/traducir modelos; Automation para tareas de diseño cuando licencias y API permitan | Viewer/Derivative no son un editor de Revit; automation de Autodesk es producto separado. OAuth, licencia, cargos y disponibilidad según contrato | READ_ONLY Model Derivative/Viewer primero; Automation solo en fase posterior |
| **Speckle** | Sincronizar e interoperar con Revit, Rhino/Grasshopper, SketchUp, Blender, etc. a través de conectores según versión/plan | Conector instalado en la herramienta y API/servicio autorizado; no es automáticamente un editor integrado del Workspace | Integración con objetos/versions Speckle mediante cuenta y permisos por empresa |
| **Documenso/Dropbox Sign** | Firmas documentales, no motor de geometría | Nunca mostrar "conectado" si solo hay contrato/spec o simulación | Usar control de integraciones existente, no mezclar con 3D |
| **Futuros Procore/Autodesk Construction Cloud** | Sincronizar documentos, incidencias, tareas o planos del GC con permisos | Sin contrato ni API autorizada no afirmar operaciones disponibles | Conector proveedor read-only sandbox con canonical mapping |

**Fuentes técnicas oficiales consultadas 2026-10-11:** APS (https://www.autodesk.com/products/autodesk-platform-services/overview, https://aps.autodesk.com/developer/overview/model-derivative-api); Blender Python (https://docs.blender.org/api/current/bmesh.html, https://docs.blender.org/api/dev/bpy.ops.export_scene.html); web-ifc (https://thatopen.github.io/engine_web-ifc/docs/); Speckle (https://docs.speckle.systems/connectors/manual-installation/introduction). Verificar versión, términos/licencias y costes antes de contratar o implementar.

## C. Inventario verificado del catálogo administrativo existente
`apps/api/src/modules/admin/admin-integrations.service.ts` enumera 5 integraciones con comprobaciones de conectividad: **OpenAI, GitHub, WhatsApp Cloud, Stripe, Dropbox Sign**. El estado runtime usa CONFIGURED_UNVERIFIED, VERIFIED, ERROR, UNCONFIGURED o SIMULATION según variables y test. `apps/web/app/(app)/admin/settings/page.tsx` tiene UI Integraciones y acciones refresh/verify. **Son entradas de catálogo, no prueba de activación real**. Promoverlas al Workspace consume el backend y respeta scopes; no duplicar secrets, catálogo ni autoridad.
El Universal Connector `packages/shared/src/universal-connector` tiene contratos/enforcement, pero spec `docs/specs/platform/universal-connector-trust.spec.md` (última verificación 2026-10-06) decía CI FAIL / UNMERGED / NOT_DEPLOYED / INACTIVE; refrescar verdad actual antes de anunciar capacidad completa.
La búsqueda dirigida de `gltf`, `web-ifc`, `@react-three/fiber`, `blender` y `autodesk` en el monorepo no confirmó un flujo 3D autor/visor integrado. No significa ausencia global; inventario de dependencies completo y pruebas antes de crear otro renderer.

## D. Experiencia objetivo en Workspace
**Empresa → Obra → Función** (autorización de servidor) visible siempre. Panel izquierdo muestra, según rol, Inicio, Tareas, Cuadrillas, Evidencia, **Modelos 3D**, **Integraciones**, Ajustes. En pantalla pequeña se presenta como tabs/menú compacto; no forzar 3D en móviles de bajo rendimiento.
- **Modelos 3D (panel central)**: Nuevo objeto · Importar GLB/IFC · Biblioteca · Ver revisiones · Vincular a obra · Pedir a Prometeo una propuesta. Selector de objeto/espacio, unidades (m/mm/in/ft), dimensiones explícitas, estado, fuente, autor, aprobación y fecha. Sin modelo real mostrar CTA honesta, no demo simulada como producción.
- **Inspector (panel derecho)**: propiedades, versión/modelo fuente, tolerancia/georreferencia, vínculo con proyecto/obra/tarea/foto/video, proveedor, historial de cambios, confianza y derechos de uso. Dos modelos contradictorios se muestran con diferencia/alerta, no se mezclan.
- **Integraciones**: Catálogo (posibilidades) ≠ Mis conexiones (instaladas) ≠ Conexión verificada (probe) ≠ Capacidad activa (policy+grant+health). Por conexión: estado verificable, scopes, modo READ_ONLY, usuario/Org autorizados, última sincronización, errores, desconectar/revocar. Los WORKER solo ven herramientas asignadas, nunca credenciales.
- **Prometeo**: «Crea una propuesta 3D de caja 4×4 con un tramo EMT de 10 pies» → traduce solicitud a **parámetros validados** del adapter; genera **borrador**; visualiza; humano revisa medidas, ubicación y derechos, aprueba/publica. Prometeo no introduce código arbitrario de Python, ni garantiza instalación real. «Muéstrame antes del sheetrock» → recupera evidencia real asociada a un elemento, no solo el render.
- El modelo puede ser **visualización paramétrica sugerida** (para presentación), **elemento BIM de diseño**, o **as-built verificado**: etiquetas de autoridad y permisos independientes.

## E. Contratos del sistema sugeridos, sujetos a SDD 2.0 y auth
**ModelRegistry** (nuevo ownership acotado de metadatos, no duplicar Evidence): `{modelId, tenantId, orgId, projectId?, siteId?, floorId?, assetId?, taskId?, providerId?, sourceFileId, canonicalVersion, format, units, coordinateFrameId?, permissionScope, status: DRAFT|REVIEW|APPROVED|OBSOLETE, origin: EXTERNAL|GENERATED|IMPORTED, sha256, createdBy, reviewedBy?, createdAt, updatedAt}`.
**ModelArtifact** `{modelId, immutableObjectRef, format: BLEND|GLB|GLTF|IFC|STEP|OBJ|... , dimensions, bounds, sourceRevision, derivativeFromId?, fileHash, createdAt}`.
**ModelJob** `{jobId, tenantId, orgId, actorId, templateId, allowedParams, provider, status: QUEUED|RUNNING|SUCCEEDED|FAILED|CANCELLED, progress, auditRef, quotas}`.
**ModelLink** referencias a elemento espacial/dibujo y evidencia con ubicación/tiempo; nunca FK a otro tenant sin grant válido.
**Propuestos, NO APIs actuales:** `GET /v1/me/work-contexts`; `GET /v1/projects/:id/models`; `POST /v1/projects/:id/models/import` (presign+scan+process); `POST /v1/projects/:id/model-jobs` (template only, idempotent); `GET /v1/model-jobs/:id`; `POST /v1/models/:id/review`; `POST /v1/connections/:id/verify` solo si se valida reuso existente. 201/202 según transacción/cola, eventos de jobs por status, source refs y razón de fallo.
**Separación:** autoría de modelo = design tool; metadata = ModelRegistry; evidencias media = Evidence; tareas = BuildOps/JobTask; tiempo = Labor Engine; capa histórica = Spatial/Temporal; autenticación = identidad/Org/Membership/Project; integración externa = Universal Connector; Prometeo = agente aprobado. No crear un segundo Workspace con tenancy propia.

## F. Checklist implementable por PR: dependencias y pruebas
**GATE-0 Base verificable:** registrar main SHA + PR859 checks, CI y Railway API/Web/Worker; identificar plantillas de design tokens, UI legacy, importación/almacenamiento de archivos, límites. Decidir primer caso eléctrico; confirmar quién es dueño legal de planos y fotos. Nada se marca DONE con documentación.

**P1 Tema/UX (PR pequeño, no cambios de backend):**
- [ ] Reutilizar `@semse/design-tokens` / CSS `--bg,--surface,--ink,--brand,--accent` para Workspace; Light/Dark, accesibilidad, contraste, móvil y capturas golden contra la app SEMSE.
- [ ] Menús dinámicos por servicio de permisos, no hardcoded; navegación canónica y fallback. Pasan WSP-01..03,15.
- [ ] Tests visuales y unitarios; desplegar canary y comparar screenshots reales (no CSS hardcoded tipo Slate).

**P2 Contexto seguro multiorg (P0 / blocking):**
- [ ] Corregir/encapsular JWT basado en primera Membership con resolución autorizada de actor/Org/proyecto/función compatible con F10/ADR-040.
- [ ] Aislar cache/estado de Workspace `(tenantId,userId,contextKey)` o proyección segura por `orgId/projectId`; migración/backfill/rollback.
- [ ] No filtrar títulos de misiones/tareas/imágenes entre Org A/B; respetar revocación incluso con JWT previo y conservar tiempo trabajado. Pruebas CTX-01..12, WSP-04,05,13,14.

**P3 Workspace acciones reales:**
- [ ] Integrar pantallas y APIs canónicas de Projects/BuildOps, Tasks, Evidence y Labor sin duplicar negocio.
- [ ] Abrir/editar/asignar tarea según permiso, subir foto original por flujo Evidence y recuperar historial verificable; panel derecho inspector real, no botón que solo cree una misión nominal.
- [ ] Prometeo propone acciones, solicita aprobación, registra quién autorizó/ejecutó; nunca anunciar "completado" sin receipt.
- [ ] E2E con empresa propia (admin) y staffing ajeno (worker), tarea piso 7, evidencia antes de cierre y reloj sin alteración. WSP-11,12.

**P4 Integraciones Workspace READ-ONLY:**
- [ ] Mostrar catálogo existente 5 proveedores desde API y estados reales, sin asumir ACTIVE; first pass no crea conexiones.
- [ ] Aislar permisos org/tenant para admin vs trabajador; usar plano de control ya existente, no nuevo secreto/registry.
- [ ] Añadir exploración de proveedores 3D con capability status NOT_CONNECTED; validar sandbox/licencias, pricing y OAuth.
- [ ] WSP-06..10,16 + spoofing, replay, revocación y fallo proveedor; no simular proveedor disponible.

**P5 Piloto modelado/visibilidad 3D:**
- [ ] Elegir **un** objeto eléctrico de prueba (caja 4×4 o tramo EMT), crear/exportar en Blender usando plantilla Python con parámetros dimensionales validados por servidor, permisos y revisión humana. Job en contenedor **aislado**, sin ejecución remota de scripts arbitrarios; límites de CPU/memoria/tiempo, sin secrets de otras Orgs, escaneo de assets, política de licencias.
- [ ] Conservar fuente editable, GLB derivado, hash, unidades/escala, actor, revisión y trazabilidad. Renderizar 3D en Workspace; la posición en edificio no se infiere de la malla.
- [ ] Probar un **IFC de muestra con derechos de uso** a través de web-ifc: piso, elementos, GUID, propiedades, unidad, coordenadas y versión sin corrupción. Viewer y modelado son rutas separadas.
- [ ] Prometeo puede solicitar draft, no publicar BIM ni modificar planos ajenos sin aprobación. Comparar dimensiones del modelo con valores esperados y tolerancia declarada.
- [ ] E2E: usuario autorizado genera/visualiza modelo, linkea a tarea eléctrica, agrega foto original fechada, otro usuario permitido ve representación+fuente; usuario ajeno recibe 403/404; 3D de baja calidad no se etiqueta as-built.

**P6 Adapters de mercado con acceso autorizado:**
- [ ] APS: probar OAuth/sandbox y una conversión + viewer de modelos reales, sin confundir Viewer/Derivative con edición; automatización CAD solo tras contrato específico.
- [ ] Speckle: probar conector compatible Revit/Blender y round-trip mínimo, preservando source IDs, permisos, versiones y evidencia de conflictos.
- [ ] Otros: Procore, Autodesk Construction Cloud, BIM/BCF import desde cliente; solo al verificar API, plan, scopes, costes, exportación y revocación.
- [ ] Cero intercambio silencioso de modelos privados entre clientes; fallos dejan la fuente intacta y estado de sync visible.

**P7 Vista 4D, CI y producción:**
- [ ] Vincular modelo a edificio/piso/habitación/pared, sistema/elemento y timeline de Evidence/BuildingEvent, verificar coordenadas y confianza.
- [ ] «¿Qué había tras la pared antes del sheetrock?» devuelve evidencia fechada y fuentes reales. Sin foto posicionada: respuesta explícita `UNKNOWN`, no geometría inventada.
- [ ] CI: typecheck, lint, unit, contract, multi-tenant negative tests, upload/multipart, media hash, GPU/CPU failure, migration, retry, idempotency, e2e web/móvil/reader y espec `spec:validate:strict`.
- [ ] Railway: comparar Git SHA exacto API/Web/Worker/vision/servicio de 3D, backups/restore, feature flag OFF→canary→on; verificar 2 identidades de Orgs distintas, conexiones activas reales y rollback. **No merge directo ni habilitar proveedores externos sin aprobaciones de seguridad y evidencia de producción.**

## G. Criterios de aceptación 3D (escenarios nuevos sin confundir con WSP)
- **3DM-01** Nuevo contexto Org A abre modelos de A; Org B no puede listar ni descargar original ni derivados.
- **3DM-02** Creación por plantilla y dimensiones probadas retorna draft+GLB+fuente editable, hash y metros/milímetros correctos.
- **3DM-03** Input que incluya código Python, enlaces externos no permitidos o excesiva complejidad se rechaza antes del worker.
- **3DM-04** Trabajador solo con permission read no puede publicar, editar original ni gestionar connector token.
- **3DM-05** IFC import mantiene GUID, piso, revisiones, coordenadas, orientación y transformaciones; no mezcla diseño/as-built.
- **3DM-06** Modelo creado por IA conserva etiqueta DRAFT, precisión incerta, humano autoriza cambios, modelo visual no suplanta inspección.
- **3DM-07** Fallo blender/APS/reintento 10 veces no crea modelos duplicados ni pierde fuente ya almacenada.
- **3DM-08** Revocación org/proyecto/conector impide nuevas lecturas/acciones con JWT previo.
- **3DM-09** 3D renderista funciona en móvil de rendimiento limitado mediante fallback 2D/imagen con aviso, sin bloqueo del reloj.
- **3DM-10** Ver historial a fecha anterior a sheetrock solo muestra verificaciones capturadas antes de fecha; archivos ausentes => UNKNOWN.
- **3DM-11** Formatos no compatibles se rechazan con motivo, modelo infectado o con script ejecutable no se procesa.
- **3DM-12** 1h de modelado/render no congela API ni UI; jobs aislados, cuota por Org y coste visible.

## H. Regla de producto — estado de los conectores al usuario
Nunca decir «puedes editar Revit en SEMSE» por tener Viewer; «puedes generar modelos 3D automáticamente» hasta tener Blender job probado; «está conectado GitHub/Stripe/WhatsApp» por mostrar el catálogo; «exactamente detrás de esta pared» sin verificación espacial. El primer resultado real debe ser pequeño, demostrable y con usuario autorizado, fuente descargable, modelo inspeccionable y auditoría.

**Entrega de este plan:** documento para revisión dentro del PR #859 (solo documentación). No se han modificado endpoints, contenedores Railway ni frontend 3D. Si el PR #859 es fusionado antes que esta actualización, abrir PR siguiente desde main con cambios faltantes; verificar estado final.
