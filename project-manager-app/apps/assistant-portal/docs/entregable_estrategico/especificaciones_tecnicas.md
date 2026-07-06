# WebAssistant: Especificaciones Técnicas (Fase 1 - MVP)

## 1. Introducción

Este documento describe las especificaciones técnicas para la implementación de la **Fase 1 (MVP)** del proyecto WebAssistant. El objetivo es definir una arquitectura robusta, escalable y segura que sirva como base para las futuras fases del producto, utilizando tecnologías modernas y probadas en la industria.

## 2. Arquitectura General del Sistema

Para el MVP, se propone una **arquitectura de microservicios monolítica modular (Monolito Modular)** para el backend, comunicada a través de una API GraphQL. El frontend será una **Single Page Application (SPA)** desacoplada. Esta arquitectura combina la simplicidad de desarrollo de un monolito en las etapas iniciales con la flexibilidad de separar los módulos en microservicios independientes en el futuro sin una reescritura completa.

### Componentes Principales:

1.  **Frontend (SPA)**: La interfaz de usuario con la que interactúan los desarrolladores.
2.  **Gateway de API**: Un único punto de entrada para todas las solicitudes del cliente, que las enruta al servicio correspondiente.
3.  **Servicio de Autenticación**: Gestiona el registro, inicio de sesión y la seguridad de las cuentas de usuario.
4.  **Servicio de Proyectos y Documentos**: Maneja la lógica de negocio para crear, editar y gestionar proyectos, documentos y tareas.
5.  **Servicio de IA**: Se comunica con APIs de modelos de lenguaje externos para potenciar las funcionalidades de IA.
6.  **Base de Datos**: Una base de datos relacional para persistir los datos de la aplicación.

## 3. Stack Tecnológico Detallado

| Componente | Tecnología | Justificación |
| :--- | :--- | :--- |
| **Frontend** | Next.js (React) | Framework líder para SPAs, ofrece renderizado del lado del servidor (SSR) y generación de sitios estáticos (SSG), mejorando el rendimiento y el SEO. Gran ecosistema y soporte de la comunidad. |
| **Lenguaje Frontend** | TypeScript | Añade tipado estático a JavaScript, lo que reduce errores en tiempo de ejecución y mejora la mantenibilidad del código a gran escala. |
| **Estilos Frontend** | Tailwind CSS | Un framework de CSS "utility-first" que permite construir diseños complejos rápidamente sin escribir CSS personalizado, manteniendo la consistencia visual. |
| **Backend** | NestJS (Node.js) | Un framework de Node.js progresivo que utiliza TypeScript. Su arquitectura modular y el uso de patrones como la inyección de dependencias facilitan la creación de aplicaciones escalables y mantenibles. |
| **API** | GraphQL | Permite a los clientes solicitar exactamente los datos que necesitan, reduciendo el sobre-fetching y el under-fetching. Ofrece un único endpoint y un esquema fuertemente tipado. |
| **Base de Datos** | PostgreSQL | Un sistema de gestión de bases de datos relacional de código abierto, potente y muy fiable. Ofrece un rendimiento excelente y soporta tipos de datos complejos y JSON. |
| **ORM** | Prisma | Un ORM de próxima generación para Node.js y TypeScript que simplifica las interacciones con la base de datos y garantiza la seguridad de tipos. |
| **IA / ML** | OpenAI API / Anthropic API | Utilizar APIs de modelos de lenguaje de última generación como GPT-4 o Claude 3 es la forma más rápida y eficiente de integrar capacidades de IA avanzadas sin la sobrecarga de entrenar y mantener modelos propios. |
| **Contenerización** | Docker | Estandariza el entorno de desarrollo y producción, asegurando que la aplicación se ejecute de la misma manera en cualquier lugar. |
| **Despliegue** | Vercel (Frontend) / AWS (Backend) | Vercel ofrece una integración perfecta con Next.js para un despliegue continuo y optimizado del frontend. AWS (usando servicios como ECS o EKS) proporciona una infraestructura robusta y escalable para el backend y la base de datos. |

## 4. Especificaciones por Componente

### 4.1. Frontend

-   **Estado de la Aplicación**: Se utilizará `React Context` o `Zustand` para la gestión del estado global. Son soluciones ligeras y eficientes para el MVP.
-   **Peticiones a la API**: `Apollo Client` para interactuar con la API de GraphQL, proporcionando caching, gestión de estado local y una excelente experiencia de desarrollo.
-   **Editor de Texto**: Se integrará una librería como `TipTap` o `Lexical` para crear un editor de texto enriquecido y extensible para la suite ofimática.
-   **Componentes UI**: Se construirá una librería de componentes reutilizables con React y Tailwind CSS.

### 4.2. Backend (Monolito Modular)

-   **Módulo de Autenticación**: Implementará autenticación basada en tokens (JWT). Gestionará el registro con correo/contraseña y OAuth 2.0 (Google, GitHub).
-   **Módulo de Proyectos**: Definirá los modelos de datos para Proyectos, Documentos y Tareas. Expondrá las mutaciones y consultas de GraphQL para las operaciones CRUD.
-   **Módulo de IA**: Actuará como un proxy seguro para las APIs de LLMs. Contendrá la lógica para construir los prompts y procesar las respuestas del modelo para la generación de comentarios.
-   **Validación**: Se utilizarán `class-validator` y `class-transformer` en NestJS para validar y transformar los datos de entrada de la API.

### 4.3. Seguridad

-   **Autenticación**: Todas las rutas de la API, excepto las de registro e inicio de sesión, estarán protegidas y requerirán un token JWT válido.
-   **Autorización**: Se implementará un sistema de permisos basado en roles (RBAC) a nivel de API para asegurar que los usuarios solo puedan acceder y modificar sus propios recursos.
-   **Protección de API**: Se utilizarán medidas de seguridad estándar como `Helmet` en NestJS para protegerse contra vulnerabilidades web comunes (XSS, CSRF, etc.).
-   **Variables de Entorno**: Todas las claves de API, secretos de JWT y credenciales de base de datos se gestionarán a través de variables de entorno y no se incluirán en el código fuente.

### 4.4. Base de Datos

-   **Esquema**: El esquema de la base de datos será definido y gestionado a través de `Prisma Migrate`, lo que permite un control de versiones del esquema y facilita las actualizaciones.
-   **Modelos de Datos (MVP)**:
    -   `User`: (id, email, passwordHash, name, provider)
    -   `Project`: (id, name, description, userId)
    -   `Document`: (id, title, content, projectId)
    -   `Task`: (id, title, status, projectId)

Este conjunto de especificaciones técnicas proporciona una base sólida para construir un MVP de alta calidad de WebAssistant, al tiempo que sienta las bases para la escalabilidad y la extensibilidad futuras.
