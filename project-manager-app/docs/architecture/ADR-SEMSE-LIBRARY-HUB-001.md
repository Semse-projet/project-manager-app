# ADR-SEMSE-LIBRARY-HUB-001 — Separar registro de dependencias, herramientas y conocimiento

- **Estado:** PROPOSED (documental; no habilita runtime)
- **Fecha:** 2026-10-25
- **Owner:** semse-core
- **Relacionado:** `docs/specs/platform/semse-library-hub.spec.md`

## Contexto

SEMSE ya tiene: `@semse/tools` para cálculos de oficio; `prometeo-tool-registry.ts` para acciones con permiso y adapter; `capability-registry` para realidad/evidencia de capacidades; bibliotecas de conocimiento para materiales y TENANT_CURATED/RAG; y dependencias externas en `package.json`, `requirements.txt` y lockfile. Ninguno equivale al otro. Una nueva «Library Hub» genérica no debe permitir a un agente saltarse políticas, leer fotos o instalar código.

## Decisión propuesta

Crear **SEMSE Library Hub** como **metadatos de supply chain y catálogo de capacidades consumibles**, no un repositorio de ZIP/paquetes ni motor de ejecución arbitraria.

- **Dependencias:** origen canónico son manifiestos de apps/paquetes + pnpm-lock y manifests Python. Catálogo indexado de solo lectura en F1. Cada cambio entra por PR revisado, no API de instalación.
- **Capacidades:** cada función autorizada utiliza un adapter estático, versionado e instalado mediante build normal; su política de acceso sigue en la autoridad del dominio o Tool Registry existente. Ningún nombre de paquete, script o import path se recibe del usuario final.
- **Conocimiento:** RAG y bibliotecas técnicas mantienen consentimientos, privacidad, versiones y autorización propios. No mover documentos de cliente a Library Hub.
- **Operación:** bajo demanda, únicamente el adapter necesario, quotas, costo/ROI, interrupción al finalizar y telemetría sin contenidos sensibles. Reusar Web/API/Worker/servicio Python existentes solo si el presupuesto/aislamiento permiten. **Ningún servicio nuevo en Railway**.
- **Seguridad:** bloquear software ejecutable de origen desconocido o sin revisión; pin por versión/integridad; SBOM, CVE, licencias, revisión independiente en alto riesgo; revisión trimestral + incidentes urgentes.
- **F0:** documentación exclusivamente. **F1:** inventario estático/SBOM. **F2/F3:** gobierno y primer adapter en slices independientes, tras spec aprobado.

## Alternativas rechazadas

1. **Guardar copias completas de todas las librerías**: duplica artefactos, incrementa almacenamiento/licencias/mantenimiento y superficie de malware.
2. **Descargar e importar paquetes a petición**: ejecución de código remoto no autorizado, imposible de garantizar con solo worker_threads.
3. **Crear un nuevo microservicio Docker/Railway por lenguaje**: contradice restricción del owner y eleva consumo base.
4. **Reusar el Tool Registry como base de datos de paquetes**: mezcla dependencias de build con permisos y side effects de herramientas.
5. **Fusionar Biblioteca Técnica/RAG con dependencias**: rompe privacidad/consentimiento y taxonomía.

## Consecuencias

- Un catálogo amplio tiene costo de documentación/escaneo, pero **no** requiere tener todos sus módulos cargados.
- «Instalada» y «ejecutable» no son sinónimos; en F1 ambos estados requieren evidencia.
- Para dependencias Python/WASM/3D grandes, si no caben en servicios existentes sin riesgo, se deja capability **BLOCKED**.
- La evaluación de rentabilidad debe ser previa y posterior al piloto, con costos medidos vs estimados; no se valida ROI por popularidad.
- Cambiar esta arquitectura requiere nuevo ADR revisado y SDD actualizado.

## Criterio de aceptación de la decisión

No existe ruta para instalar código por HTTP, no nace ningún servicio, no se alteran permisos de Prometeo ni dominio financiero, se mantiene el catalogo de aplicaciones y se produce inventario objetivo antes de escoger nuevas librerías.
