# SEMSE: recorrido virtual desde fotografías + historia 4D
**Captura de producto:** 2026-10-11. **Estado:** diseño propuesto; NO implementado ni desplegado.
**Fuente:** usuario describe «tomas fotos, las reúnes y creas un espacio tridimensional; vas caminando virtualmente como si estuvieras allí, con renderizado en tiempo real».
**Depende de:** PRODUCT_REQUIREMENTS, SYSTEM_ARCHITECTURE, WORKSPACE_EXECUTION_3D_INTEGRATIONS_CHECKLIST, MULTI_ORG_CONTEXT_SELECTOR_UX y los dueños canónicos Evidence/Spatial/Temporal/Tasks.

## 1. Terminología inequívoca
La capacidad tiene nombres técnicos: **reconstrucción 3D desde fotos**, fotogrametría SfM/MVS, radiancia neural (NeRF) y **3D Gaussian Splatting**. Los tours fotográficos 360 también permiten recorrer posiciones enlazadas sin una geometría íntegra.

- **Captura:** fotos solapadas desde posiciones distintas, video, panoramas 360 y, opcionalmente, LiDAR/referencias físicas.
- **Reconstrucción:** antes de recorrer la escena, software calcula poses de cámaras y malla/puntos o campo/splats; habitualmente requiere procesamiento, y GPU para 3D Gaussian Splatting.
- **Recorrido interactivo:** con escena ya procesada, el navegador renderiza nuevas vistas mientras el usuario se mueve de manera fluida; **no significa que las fotos estén siendo reconstruidas desde cero por cada cuadro**.
- **4D:** capturas originales y snapshots fechados por etapa, por ejemplo antes/después de colocar sheetrock. La escena no actualiza sola los cambios físicos; hace falta nueva captura y verificación.
- **Evidencia:** la vista 3D es un derivado visual. Los archivos originales, fechas, personas, revisores, ubicación, escalas y hashes quedan asociados a canonical Evidence y a planos/elementos. Un recorrido bonito no demuestra coordenadas precisas ni ausencia de cables.

## 2. Opciones y criterios
| Método | Lo que entrega | Ventaja | Límite |
|---|---|---|---|
| Tour 360 + hotspots | Panoramas conectados; movimiento entre puntos y giro local | MVP barato, rápido y usable en móviles | No da geometría BIM ni desplazamiento libre pleno |
| **COLMAP, SfM/MVS** | Poses, puntos y posible malla/texturas | Geometría que puede calibrarse/ligarse a plano | Precisión depende de referencias/escala; superficies blancas, brillos y poca cobertura fallan |
| **Nerfstudio Splatfacto, Gaussian Splatting** | Escena fotorrealista y cámara libre en áreas cubiertas | Sensación de caminar realmente por el sitio; renderizado rápido una vez generado | Requiere entrenamiento GPU, no es malla CAD ni garantiza medidas |
| NeRF | Campo radiancia con nuevas vistas | Representaciones visuales avanzadas | No es CAD o IFC; computación y exportación dependientes del método |
| **Matterport, Polycam** | Captura guiada y recorrido/digital twin de terceros | Menos ingeniería de captura y procesamiento | Comprobar API, exportación, precios, licencias, derechos y retención |

Referencias técnicas verificadas (consultas 2026-10-11): COLMAP https://colmap.github.io/tutorial.html ; Nerfstudio https://docs.nerf.studio/nerfology/methods/splat.html ; Matterport https://matterport.com/how-to-capture ; Polycam https://learn.poly.cam/hc/en-us/articles/27425185907348-How-to-Use-Object-Mode .

No tratar Blender (autoría/edición) como equivalente a un capture engine. Fotogrametría/3DGS reconstruyen lo observable, no dibujan automáticamente instalaciones correctamente diseñadas.

## 3. Flujo real de SEMSE en una obra eléctrica
1. Administrador autoriza sitio, derechos de fotos y retención; encargado define piso, habitación/pared, trade, tarea y etapa: antes/durante/después y **antes de tapar con sheetrock**.
2. Trabajador recibe una misión de captura ligada a tarea y zona. App indica desplazarse con la cámara alrededor de la instalación, obtener varias vistas superpuestas con luz estable, fotografiar escala conocida/marcadores QR y evitar imágenes borrosas o con personas innecesarias.
3. Evidencias originales entran por Evidence de forma idempotente; se conservan hash, actor, claimedCaptureTime/EXIF, serverReceivedAt, proyecto, plano/versión y contexto espacial. La hora declarada y GPS del móvil no son verificación absoluta.
4. Reconstruction Worker aislado procesa el conjunto usando método elegido y límites de CPU/GPU, tiempo, tamaño y costo. Registra fallas, versión del pipeline, poses y archivos derivados sin sobrescribir originales.
5. Encargado/inspector valida cobertura, escala, correspondencia con plano, áreas ciegas y requisitos de pre-concealment. No se marca AS_BUILT_VERIFIED por salir un splat o una malla; requiere corroboración.
6. Se publica solo a personas autorizadas. En Workspace → Obra → «Recorridos 3D» se seleccionan nivel/zona/fecha, se navega visualmente y se pueden abrir fotos fuente por objeto o superficie.
7. Meses más tarde, otro electricista consulta la pared del piso siete «antes del sheetrock». Prometeo recupera captura anterior, historial, tarea y revisión, entrega fuentes y nivel de confianza. Si no hay fotos de una zona, indica DESCONOCIDO, nunca inventa cableado oculto.
8. Se vuelve a capturar si cambia la obra. Las fechas de captura y registro permanecen separadas; los snapshots de marzo y julio no se mezclan ni convierten mágicamente en video continuo de meses.

## 4. Experiencia de usuario
**Cabecera:** Empresa → Obra → Rol, validado por backend, con bandera de jornada activa. 
**Panel izquierdo:** plano/edificio → piso → sala/zona/pared y filtros de etapa temporal.
**Centro:** visor panorámico, malla o 3DGS con movimiento, controles de navegación; botón «Ver foto original» y fallback 2D para teléfonos lentos.
**Panel derecho:** fecha del snapshot, estado de revisión, fuente/capturas originales, encargado, tarea, plano/calibración y precisión declarada, cambios posteriores. Etiquetas DRAFT, ESTIMATED, REVIEWED, VERIFIED solo si realmente aplica.
**Prometeo:** «Compárame esta pared entre enero y junio»; evidencia fuente real o NO DOCUMENTADO. No deducir ni autorizar perforación/cortes por modelos sin verificación.
**Móvil:** guía de fotos, cola offline, capturas antes del cierre y rutas rápidas; preservar reloj y otros flujos si viewer/GPU fallan.

## 5. Contratos de datos propuestos (NO tablas ni endpoints actuales)
CaptureSession: {id,tenantId,orgId,projectId,siteId,floorId,zoneId,taskId,capturePurpose,createdBy,originalEvidenceIds,drawingRevisionId,claimedCapturedAt,uploadedAt,rightsPolicyId}.
ReconstructionJob: {id,captureSessionId,method(PANORAMA|SFM_MVS|GAUSSIAN_SPLAT|NERF|EXTERNAL_PROVIDER),pipelineVersion,status(QUEUED|RUNNING|REVIEW|FAILED|CANCELLED|PUBLISHED),idempotencyKey,limits,qualityReportRef,outputArtifactRefs}.
ReconstructionAsset: {id,jobId,format(PANORAMA|GLB|PLY|SPLAT|POSES|MESH),objectRef,hash,coordinateFrame,scaleCalibrationRef,precisionClass,revision}.
WalkthroughSnapshot: {id,projectId,zoneId,buildingElementRefs,captureSessionIds,reconstructionAssetIds,observedTimeRange,recordedAt,buildingState,rightsAndReviewRef,previousSnapshotId}.
La metadata pertenece a Spatial/Temporal; fotos y videos originales pertenecen a Evidence; la UI Workspace no se convierte en un propietario de datos. Revisar SDD 2.0 y contratos API en otro PR antes de migraciones.

## 6. Seguridad y precisión
- Respetar copyright/derechos del GC, consentimiento y privacidad de personas, retención, compartir con expiración y separación tenant/Org/proyecto.
- Con solapamiento insuficiente, luz mala o superficies repetitivas, el sistema debe fallar con informe de cobertura, no presentar una reconstrucción «verificada».
- 3DGS y fotogrametría no garantizan escala/posición interior exacta; calibrar contra mediciones profesionales antes de usar dimensiones constructivas. Posibles artefactos de render, oclusiones, geometría falsa y zonas invisibles.
- Cualquier comando automático de modelado/creación de escena pasa por permisos, límites y aprobación. Nunca ejecutar scripts arbitrarios de un usuario/proveedor. Proveedor externo no recibe secretos de otras Orgs.
- Procesamiento costoso en workers aislados y job queue; cuotas/costos, reintentos idempotentes y recuperación/backup de originales; no saturar API/Labor Engine.
- Archivos derivados y visitas de terceros no sustituyen datos propios. Asegurar portabilidad y acceso histórico cuando desconecten Matterport/Polycam.

## 7. Piloto inicial propuesto, compatible con fases ya aprobadas
Usar una sola pared eléctrica o habitación antes de cerrar con sheetrock, en una obra donde la empresa tenga derecho a documentar. Asociar task/plan/QR/escala y crear dos momentos si el ciclo de trabajo permite. Primero publicar tour de panoramas/hotspots con fotos fuente; después reconstruir exactamente el mismo material con COLMAP, y entrenar Nerfstudio Splatfacto en GPU disponible/contratada solo si resulta viable. Comparar navegación, zonas ciegas, costo, tiempo de proceso y certeza de ubicación. Sin detección fiable de paredes ocultas, se muestra advertencia.
Solo proponer integración propietaria Matterport/Polycam después de validar API/exportación/licencia/seguridad; el recorrido no exige que el GC adopte SEMSE.

## 8. Pruebas nuevas PWR
- PWR-01: 20–100 imágenes con cobertura suficiente permiten intentar reconstrucción, y mala cobertura se informa; no se promete éxito por cantidad.
- PWR-02: 360 permite giro y salto entre estaciones; GS permite cámara libre únicamente en áreas capturadas.
- PWR-03: hash/provenance de originales y derivados, fechas declaradas vs servidor, versiones y revisión sin sobrescribir.
- PWR-04: etapa antes/durante/después del sheetrock recupera snapshots temporales separados, sin mezclar obra futura con pasada.
- PWR-05: worker Org B sin acceso no puede leer originales, miniaturas, manifest, viewer ni render de Org A.
- PWR-06: escala no calibrada muestra ESTIMATED; nunca medidas certificadas.
- PWR-07: usuario autorizado a los 8 meses encuentra las fotos originales y la ubicación declarada con fuentes y confianza.
- PWR-08: EXIF/timestamps alterados no se convierten en fechas verificadas.
- PWR-09: error/reintento GPU no duplica job ni destruye archivos fuentes.
- PWR-10: teléfono de bajo rendimiento usa panorama/imagen 2D; reloj y captura siguen funcionales.
- PWR-11: navegación virtual no inventa trabajo no capturado entre dos fechas; Prometeo marca desconocidos.
- PWR-12: revocar proveedor o membership corta acceso futuro, permite recuperar originales autorizados; no cruces de tenants.

## 9. Gates de ejecución
Documentación aprobada y revisión legal/captura de campo → diseño SDD de CaptureSession/Spatial + Evidence → captura móvil + panorama con permisos → reconstrucción asíncrona COLMAP → piloto GS GPU → barra temporal y Prometeo con fuentes → pruebas CI/e2e/recovery → canary autenticado Railway/API/web/worker/GPU, SHA exacto y rollback. No afirmar feature LIVE hasta que existan evidencias reales de extremo a extremo. Esta página registra requisitos; no despliega ningún sistema.


## 10. Arquitectura de referencia para un MVP verificable (continuación de diseño 2026-10-11)
Esta sección convierte el concepto de caminar dentro de fotos en contratos de ingeniería comprobables; ningún componente enumerado queda habilitado por escribirlo aquí.

**Plano de datos y dueños:**

\`\`\`text
Capturador móvil (fotos/video/panorama + zona/etapa/medidas)
  -> preflight de permisos/privacidad/calidad (cliente; NO authoritative)
  -> Evidence Ingestion canónico (originales inmutables, hash, actor, origen)
  -> CaptureSession/manifest (ref a originales; Org/Proyecto/Zona/Etapa)
  -> cola ReconstructionJob, idempotencyKey, cuota/presupuesto de org
  -> Worker aislado (CPU: SfM/COLMAP; GPU bajo demanda: 3DGS/Splatfacto)
  -> artifact store privado con versiones (poses, quality report, PLY/SOG/GLB)
  -> inspección humana y calibración/alineación a plano por puntos medidos
  -> visor Workspace autenticado + signed URLs temporales
  -> snapshot temporal Spatial/Temporal + Evidence lineage -> Prometeo grounding
\`\`\`

**No poner entrenamiento de 3DGS dentro del request HTTP de API.** La Web/API existentes en Railway pueden gestionar orquestación, estado y permisos; el procesamiento GPU podrá estar en un worker aislado y compatible con infraestructura GPU **solo después** de validar soporte real, disponibilidad y presupuesto. No suponer que un worker CPU actual permite entrenar escenas completas o que Railway ofrece una GPU específica sin comprobar su servicio. Si se usa un procesador externo, debe haber un acuerdo de tratamiento de datos y controles de transferencia, residencia/retención y eliminación.

**Visor inicial que conviene evaluar:** \`@playcanvas/supersplat-viewer\`, de código abierto bajo MIT, integrado/autoalojado en SEMSE; no subir fotografías privadas o archivos splat al alojamiento público de superspl.at por defecto. SuperSplat puede consumir archivos PLY de Gaussian Splats y formatos más compactos como SOG. El editor y visor abiertos no implican que los servicios alojados de publicación/galería sean abiertos; revisar términos antes de activar un proveedor hospedado. Para panorama 360 usar visor independiente con hotspots/estaciones vinculadas a un plano. Mantener renderizador de malla GLB/IFC como carril distinto al viewer de splats.

**Ruta de escena:** \`/workspace/projects/:projectId/spatial/captures/:captureSessionId\` es una **ruta propuesta**. El backend debe resolver actor/Org/proyecto para cada solicitud, incluir assets firmados con TTL corto y validar las descargas del original; que alguien pueda ver el tour no implica que pueda descargar archivos ni otorgar acceso a terceros. El manifiesto de geometría lleva versión de escena, formato, puntos/cámaras, \`coordinateFrame\`, \`scaleConfidence\`, \`captureDateRange\`, \`reviewStatus\`, \`pipelineVersion\`, \`sourceEvidenceIds\`, \`rightsScope\` y \`processedAt\`.

**Renderizado y navegación:** un splat produce vistas intermedias a partir de posiciones de cámara; no garantiza geometría sólida, colisiones, superficies utilizables para medición ni acceso visual a lo que nunca se fotografió. Un modo \`FLY/ORBIT\` libre no se presenta como recorrido físicamente seguro. El modo \`WALK\` se habilita solo cuando hay una malla de colisión/hitos de navegación validados y tolerancias suficientes; SuperSplat Viewer permite integrar malla de colisión independiente, que hay que generar/revisar. Si no existe, usar cámaras/hotspots válidos, límites de navegación y etiquetar \`VISUALIZACIÓN\`.

## 11. Guía de captura en campo y control de calidad
**Primer piloto:** pared/corredor eléctrico de un solo piso, **antes** de cerrar con sheetrock, sin pasajeros/terceros innecesarios, con autorización del empleador/GC y responsable del sitio. El usuario crea una \`CaptureSession\` dentro de la tarea, indica propósito, edificio/piso/zona, fase y fecha de captura declarada, obtiene una aprobación o política de conservación, y registra referencias para localizar esa pared meses después.

**Secuencia operativa mínima:**
1. Verificar permisos y área segura para documentar (nunca recorrer zonas peligrosas capturando con el teléfono); limpiar datos sensibles visibles cuando corresponda, sin alterar ni reemplazar la evidencia original.
2. Identificar zona, punto físico de inicio, plano y revisión; fotografiar una referencia dimensional conocida y registrar la medición en una entidad/nota auditable. Un QR por sí solo identifica ubicación pero NO establece escala métrica.
3. Capturar vistas **con traslación real**, gran solapamiento y ángulos distintos: no limitarse a girar en un solo punto. Evitar movimiento borroso, objetos móviles, superficies repetitivas, cambios drásticos de exposición y huecos de cobertura. Más imágenes no equivalen automáticamente a mejor reconstrucción.
4. Subir originales con checksum, tamaño, orientación, archivo de cámara y metadatos separados; respetar condiciones offline y sincronización idempotente. El sistema muestra qué imágenes faltan/procesos fallaron, sin borrarlas.
5. Procesar poses y generar vista 360 o estructura sparse primero; si el material y presupuesto permiten, entrenar splat y crear derivado web. Guardar reporte de cobertura/zonas ciegas e imposibilidad de reconstrucción.
6. Revisión humana: confirmar únicamente lo que las fotos efectivamente enseñan y fijar la ubicación en plano usando referencias medibles; aprobar \`REVIEWED\` solo cuando se cumple la política de evidencias. \`AS_BUILT_VERIFIED\` exige comprobación adicional independiente y nunca se concede por fotorrealismo.
7. Mostrar en Workspace la línea temporal con *snapshots discretos*, no una película inventada entre meses. Permitir alternar captura A/B y fotos vinculadas a tareas y cambios de obra.

**Advertencias de producto:** cualquier posición de conductor que aparezca delante o detrás de paneles solo refleja evidencia capturada del momento. Antes de taladrar paredes cerradas, la herramienta debe exigir verificación local con medios apropiados. No convertir splat a autoría BIM o precisión topográfica por inferencia automática de Prometeo.

## 12. Orden exacto de entrega y pruebas de aceptación de la integración
| PR hijo propuesto | Resultado demostrable | Dependencia/gate |
|---|---|---|
| CAP-0 | SDD 2.0 de \`CaptureSession\`, datos espaciales, propiedad Evidence, aislamiento por Org, permisos/retención, tamaños y formatos | Aprobación del dueño de producto + identity/ADR |
| CAP-1 | En Workspace, crear sesión de captura, asociar tarea/obra/zona y subir originales; estado real de avance y error | RBAC/cross-org probado, no asumir sesión global |
| CAP-2 | Recorrido 360 con estaciones, plano, fecha y botón «Ver foto original»; móvil con fallback ligero | Ingestión/retención/planos probados |
| CAP-3 | Reconstrucción COLMAP asíncrona, poses/quality report/versiones, manifest y links por evidencia | Sandbox, cuotas, colas, idempotencia y derecho de datos |
| CAP-4 | Gaussian Splat training piloto y visor autoalojado \`supersplat-viewer\` con formatos PLY/SOG, control por contexto | GPU/contrato/licencias/performance reales |
| CAP-5 | 4D temporal: comparar dos etapas, revisar etiquetas/zonas ciegas, Prometeo responde con vínculos a capturas originales | Grounding, permisos, provenance y validación humana |
| CAP-6 | Ensayos de carga, fallo de proveedor, backups, borrado y revocación; canario real Railway con 2 Orgs | CI verde, SHA de servicios, ejecución auténtica e informe rollback |

**Casos adicionales:**
- **PWR-13:** una cuenta Admin de Org A cambia al workspace de Org B como WORKER: la escena, thumbnails, URLs firmadas y cachés de A se bloquean incluso con un enlace conocido; otro rol con acceso solo a tarea no puede bajar toda la escena.
- **PWR-14:** un visor no autorizable o archivo SOG/PLY defectuoso falla de manera controlada; no aparecen splats o datos de demo como si fueran evidencia de un cliente.
- **PWR-15:** en teléfono de rendimiento limitado se activa panorama 360 o foto fuente antes que saturar GPU/memoria; captura y reloj continúan sin interrupciones.
- **PWR-16:** no se permite caminar «a través» de muro/suelo como si fuera visita física salvo que exista y se haya validado malla de colisión; sin ello se ofrece orbit/hotspots con etiqueta de aproximación.
- **PWR-17:** exportaciones y desconexión del proveedor permiten recuperar originals + poses + versión del splat cuando formato/licencia lo permita; sin dependencia exclusiva del sitio de terceros.
- **PWR-18:** un resultado sin escala validada no habilita medir distancias constructivas ni proponer corte/perforación autónomos, y Prometeo explica el nivel de confianza.

**Referencias técnicas para el implementador:** COLMAP \`https://colmap.github.io/tutorial.html\`; Nerfstudio Splatfacto \`https://docs.nerf.studio/nerfology/methods/splat.html\`; PlayCanvas SuperSplat \`https://developer.playcanvas.com/user-manual/gaussian-splatting/editing/supersplat/\`; formatos \`https://developer.playcanvas.com/user-manual/supersplat/editor/import-export/\`; viewer \`https://github.com/playcanvas/supersplat-viewer\`. Versionar las dependencias y validar licencia exacta en cada release.

**Resumen de alcance:** este documento NO es una entrega funcional. El primer hito que cuenta es un trabajador autorizado subiendo fotos originales y un supervisor autorizado recorriendo el mismo lugar reconstruido, con referencias al estado de obra y acceso correctamente denegado a otra organización.