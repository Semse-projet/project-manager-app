# Análisis de consistencia — consolidación móvil

Autorización: solicitud explícita del propietario el 2026-09-06 de consolidar el único producto SEMSE, sin borrar, incluyendo código, configuración y documentos.

Constitución: se conservan backend único, contratos compartidos, RBAC, ownership y estados de entrega independientes. La consolidación no autoriza a falsificar calidad ni resultado de producción. El spec precede a la implementación y sus pruebas preceden a los cambios de código.

Conflictos detectados: dos proyectos EAS con mismo identificador; variables distintas de API; sesiones y navegación divergentes; cambios locales sin publicar; metadata de builds recientes no recuperada en los Git consultados. Resolución: inventario y adaptación sobre main, sin elegir una copia por su nombre ni destruir las otras.

Riesgos de implementación: el temporizador recuperado ocultaba errores de servidor como modo offline; LiveKit no puede cargarse incondicionalmente en Expo Go; las sesiones en vivo recuperadas deben mantener autorización antes de suscribir SSE. Estos puntos requieren corrección y pruebas, no importación automática.

Límites de evidencia: no hay canary autenticado ni versión instalada comprobada en los teléfonos. Mantener abiertos los gates correspondientes mientras se completa el trabajo local independiente.
