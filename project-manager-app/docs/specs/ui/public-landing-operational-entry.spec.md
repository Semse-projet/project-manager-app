---
type: spec
feature: "Public Landing and Operational Entry"
domain: "ui"
version: "1.0"
status: "APPROVED"
risk: low
branch: "feature/landing-clean-stable"
date: "2026-06-10"
author: "Antigravity — session SDD governance"
spec_index: "docs/SPEC_INDEX.md"
depends_on: "docs/specs/ui/intake-flow.spec.md"
related_endpoints: []
related_events: []
related_agents: []
related_files:
  - apps/web/app/(public)/page.tsx
  - apps/web/components/landing/landing-nav.tsx
  - apps/web/components/landing/landing-footer.tsx
  - apps/web/components/landing/landing-intake.tsx
  - apps/web/components/landing/landing-routes.ts
  - apps/web/components/landing/operational-routes-grid.tsx
related_tests:
  - tests/e2e-semse/public-landing.spec.ts
last_verified: 2026-06-10

---

# Spec: Public Landing and Operational Entry

> Especificación del diseño y comportamiento de la página de inicio pública y los puntos de entrada operacionales por rol.
> Este documento gobierna la experiencia visual, la navegación y las redirecciones de la landing principal.

---

## 1. Qué resuelve

**Para quién:** Clientes potenciales, profesionales, contratistas y administradores internos.  
**Problema:** Una landing page genérica o sobrecargada desvía a los usuarios del flujo correcto y no comunica el valor central de SEMSE.  
**Solución:** Una landing page limpia, responsiva, con soporte de temas light/dark, que comunica un mensaje claro de "pago por hitos/avances" y guía de forma precisa a cada rol hacia su respectivo espacio de trabajo (wizard de intake, login/registro de profesionales y acceso administrativo interno discreto).

---

## 2. Actores y Permisos

| Actor | Rol SEMSE | Puede hacer | No puede hacer |
|---|---|---|---|
| Cliente Anónimo | `ANONYMOUS` | Ver landing, buscar trabajos, usar el brief de intake, ver información de servicios | Entrar a dashboards, liberar pagos o ver el Evidence Vault |
| Profesional Anónimo | `ANONYMOUS` | Ver landing, ver ruta de profesionales, ir a registro/login | Ver panel interno de operador sin autenticación |
| Administrador / Operador | `ADMIN` | Acceder a "Acceso interno" en el footer de la página para ingresar | Evitar el flujo de autenticación |

---

## 3. Escenarios de Usuario

### P1 — Intake de Proyecto desde Hero/Brief
**Journey:** El cliente anónimo entra a la landing page, describe su proyecto en la sección de Intake, hace clic en "Analizar" y es redirigido al wizard dinámico de estimación y categorización.

**Criterio de aceptación:**
```
DADO   que un cliente anónimo se encuentra en la landing page ("/")
CUANDO describe su proyecto en el textarea ("Cuentanos que necesitas hacer") y hace clic en "Analizar"
ENTONCES la aplicación realiza una solicitud a "POST /v1/smart-intake/analyze"
  Y redirige al usuario a la página de cuestionario adaptativo "/intake/:id" sin requerir autenticación previa.
```

**Casos borde:**
- [ ] Textarea vacío o menor a 10 caracteres: el botón de "Analizar" debe estar deshabilitado o mostrar validación de error en cliente.

---

### P2 — Acceso Rápido por Rol ("Elige tu ruta de trabajo")
**Journey:** El profesional o contratista entra a la landing, desplaza la pantalla hasta la sección de "Rutas operativas" y selecciona "Buscar trabajos" o "Subir evidencia", siendo redirigido al flujo de login con la redirección adecuada.

**Criterio de aceptación:**
```
DADO   que un usuario visita la sección "Elige tu ruta de trabajo"
CUANDO selecciona "Buscar trabajos" o "Subir evidencia"
ENTONCES es redirigido a "/login?from=/worker/dashboard" o "/login?from=/worker/evidence" respectivamente.
```

---

### P3 — Acceso Interno Administrativo
**Journey:** Un operador interno o administrador necesita acceder a la consola. Despliega la landing, va hasta el pie de página (footer) y hace clic en "Acceso interno".

**Criterio de aceptación:**
```
DADO   que un administrador está en la landing page pública
CUANDO navega al footer y hace clic en "Acceso interno"
ENTONCES es redirigido a "/login?from=/admin/dashboard" de forma segura y discreta.
```

---

## 4. Estructura de la UI y Diseño Responsivo

1. **Header (Navegación Pública):**
   * Logo canonical de SEMSE Project.
   * Enlaces rápidos internos (`#servicios`, `#como-funciona`, `#prometeo`, `#profesionales`).
   * Switch de cambio de tema (light/dark) persistido en `localStorage` bajo la clave `public-theme`.
   * CTA principal "Publicar proyecto" redirige a `/client/jobs/new`.
2. **Hero Section:**
   * Mensaje principal: *"No pagues por promesas. Paga por avances verificados."*
   * CTA primario: *"Publicar mi proyecto gratis"* -> `/client/jobs/new`.
   * CTA secundario: *"Soy profesional"* -> `/login?from=/worker/dashboard`.
3. **Trust Bar (Barra de Confianza):**
   * Muestra las 5 capacidades operativas: *IA Conectada, Pagos por Hitos, Evidencia Verificable, Profesionales por Reputación, Soporte en Disputas*.
   * Debe ser 100% responsiva (flex wrapped o scroll horizontal en móvil, sin romper layout).
4. **Intake Section:**
   * Título: *"Cuentanos que necesitas hacer"*.
   * Textarea de entrada libre y selectores de categoría inicial.
5. **Operational Routes Section ("Elige tu ruta de trabajo"):**
   * Grid de tarjetas de acción rápida redirigiendo a los flujos adecuados.
6. **Footer:**
   * Enlaces corporativos y legales (*Privacidad, Términos, Eliminación de datos*).
   * Enlace discreto "Acceso interno" en lugar de enlaces públicos destacados de administración.

---

## 5. Criterios de Éxito

| Métrica | Valor objetivo |
|---|---|
| Responsividad Móvil | Sin desbordamiento lateral (no horizontal overflow) en anchos >= 320px |
| Soporte de Temas | Sincronización en tiempo real del atributo `data-theme` en `html` y clase `.public-theme` |
| Cobertura de Tests Playwright | 100% de escenarios P1, P2 y P3 cubiertos en E2E |
| Tasa de Rebote de Redirecciones | 0% (todos los enlaces a `/client`, `/worker` y `/admin` deben ser rutas válidas) |

---

## 6. Tests Requeridos

```typescript
describe("Public Landing Page E2E", () => {
  it("debe renderizar el hero con el título canónico", async () => {
    // Verificar encabezado y subtítulo
  });

  it("debe alternar temas light y dark al hacer clic en el switch de tema", async () => {
    // Verificar localStorage y atributo data-theme
  });

  it("debe enviar el brief e iniciar el smart intake wizard al enviar el formulario", async () => {
    // Rellenar textarea, pulsar Analizar, verificar redirección a /intake/:id
  });

  it("debe redirigir a login con el parámetro 'from' correcto desde las tarjetas de ruta", async () => {
    // Verificar enlace 'Buscar trabajos' redirige a /login?from=/worker/dashboard
  });

  it("debe proveer acceso administrativo discreto en el footer", async () => {
    // Verificar que 'Acceso interno' redirige a /login?from=/admin/dashboard
  });
});
```

---

## 7. Checklist de Aprobación

- [x] Todos los escenarios P1, P2 y P3 definidos con Given/When/Then.
- [x] Reglas de accesibilidad y diseño responsivo documentadas.
- [x] Enlaces y redirecciones mapeados exactamente.
- [x] Documento registrado en `docs/SPEC_INDEX.md`.
