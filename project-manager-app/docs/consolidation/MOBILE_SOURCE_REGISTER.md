# Registro de fuentes del único producto SEMSE

Fecha: 2026-09-06. La instrucción vigente autoriza consolidación aditiva y prohíbe borrar. «Copias» describe ubicaciones del mismo producto, no productos distintos.

| Fuente | Procedencia | Tratamiento |
| --- | --- | --- |
| GitHub main | `Semse-projet/project-manager-app`, `88171003` | Base de integración; móvil, API, web y contratos actuales |
| `Desktop/project-manager-app` | HEAD `34143dc9`, cambios móviles pendientes | Original preservado; revisar y adaptar navegación, dependencias y temporizador |
| `semse-mobile` | Sin commits; EAS `8717b821-e268-4adf-9f7b-64bb4ce6c4ad` | Original preservado; recuperar capacidades de Prometeo, tareas, notificaciones y perfil |
| `project-manager-app-main/project-manager-app` | Árbol sin Git; contiene LiveSession | Original preservado; revisar contratos, dominio, pruebas y migración de sesiones en vivo |
| `Desktop/semse-consolidated` | Worktree `feat/semse-product-consolidation-20260906` desde main | Destino de esta integración; no publicado todavía |

No se modificaron ni eliminaron los repositorios, ramas, archivos o proyectos EAS de origen. La copia de integración no reemplaza una instalación por sí sola.

Builds observados: EAS `718f27b3-c5b9-4f5c-a695-94fd3f85a5c7` tiene iOS preview `0e440255…` (0.1.0/6, commit `2deefd26…`) y Android development `58e92a35…` (0.1.0/1, commit `cd534762…`). El EAS `8717b821…` tiene iOS production `dcee7861…` (1.0.0/12) y Android production `b510bc29…` (1.0.0/4), sin SHA declarado. Todos FINISHED; instalación y tienda no verificadas. Conservar ambos historiales.

Identificadores existentes: `com.semse.mobile` en iOS y Android. No se regeneran certificados ni se cambia el identificador durante la integración. El proyecto EAS de la entrega debe quedar explícito en la configuración y los recibos antes de publicar.

Pendiente de procedencia: los commits `2deefd26…` y `cd534762…` de las compilaciones recientes no están todavía recuperados. Esto no impide consolidar las fuentes disponibles, pero impide afirmar que se preservó cada modificación de esos builds.
