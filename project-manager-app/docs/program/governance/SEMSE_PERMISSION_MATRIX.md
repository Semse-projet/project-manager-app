# SEMSE Permission Matrix

## Fecha
2026-03-19

## Propósito

Definir una base implementable para roles, herramientas y permisos de SEMSE Project.

Esta matriz no intenta resolver toda la complejidad futura.
Busca dejar una estructura clara para:
- navegación frontend;
- RBAC backend;
- módulos del MVP;
- ownership por grupo;
- escalabilidad posterior.

---

## 1. Grupos canónicos

### Workforce
Usuarios que ejecutan el trabajo materialmente.

### Clients
Usuarios que originan la demanda, financian y validan resultados.

### Operations
Usuarios que administran, controlan, auditan y sostienen el sistema.

---

## 2. Roles MVP recomendados

## Workforce
- `helper`
- `technician`
- `crew_lead`
- `subcontractor`

## Clients
- `residential_client`
- `property_manager`
- `commercial_client`

## Operations
- `ops_admin`
- `finance_admin`
- `qa_admin`
- `super_admin`

---

## 3. Módulos base del MVP

1. `dashboard`
2. `jobs`
3. `tasks`
4. `evidence`
5. `messaging`
6. `payments`
7. `milestones`
8. `documents`
9. `incidents`
10. `profile`

## Módulos operativos / fase siguiente
11. `qa`
12. `compliance`
13. `reports`
14. `disputes`
15. `materials`
16. `time_tracking`
17. `users`
18. `settings`

---

## 4. Acciones canónicas por módulo

## Dashboard
- `dashboard.view_own`
- `dashboard.view_group`
- `dashboard.view_global`

## Jobs
- `jobs.view_own`
- `jobs.view_assigned`
- `jobs.view_all`
- `jobs.create`
- `jobs.edit_own`
- `jobs.edit_all`
- `jobs.assign`
- `jobs.reassign`
- `jobs.close`

## Tasks
- `tasks.view_assigned`
- `tasks.view_job`
- `tasks.create`
- `tasks.update_status`
- `tasks.reassign`

## Evidence
- `evidence.upload`
- `evidence.view_own`
- `evidence.view_job`
- `evidence.approve`
- `evidence.reject`
- `evidence.comment`

## Messaging
- `messaging.view_job`
- `messaging.send_job`
- `messaging.moderate`

## Payments
- `payments.view_own`
- `payments.view_job`
- `payments.fund`
- `payments.approve_release`
- `payments.release`
- `payments.reconcile`

## Milestones
- `milestones.view`
- `milestones.create`
- `milestones.update`
- `milestones.submit`
- `milestones.approve`
- `milestones.reject`
- `milestones.request_changes`
- `milestones.close`

## Documents
- `documents.upload_own`
- `documents.view_own`
- `documents.view_job`
- `documents.validate`
- `documents.archive`

## Incidents
- `incidents.create`
- `incidents.view_job`
- `incidents.resolve`
- `incidents.escalate`

## Profile
- `profile.view_self`
- `profile.edit_self`
- `profile.view_public`

## QA
- `qa.view`
- `qa.review`
- `qa.approve`
- `qa.reject`
- `qa.request_rework`

## Compliance
- `compliance.view`
- `compliance.validate`
- `compliance.expire`

## Reports
- `reports.view_self`
- `reports.view_org`
- `reports.view_global`

## Disputes
- `disputes.create`
- `disputes.view_job`
- `disputes.assign`
- `disputes.resolve`

## Materials
- `materials.request`
- `materials.view_job`
- `materials.approve`
- `materials.manage_inventory`

## Time Tracking
- `time_tracking.clock`
- `time_tracking.edit_own`
- `time_tracking.view_job`
- `time_tracking.audit`

## Users
- `users.view`
- `users.create`
- `users.edit`
- `users.suspend`
- `users.assign_roles`

## Settings
- `settings.view`
- `settings.edit_global`

---

## 5. Matriz por grupo y rol

## 5.1 Workforce

### helper
**Módulos principales**
- dashboard
- jobs
- tasks
- evidence
- messaging
- incidents
- payments
- profile

**Permisos recomendados**
- `dashboard.view_own`
- `jobs.view_assigned`
- `tasks.view_assigned`
- `tasks.update_status`
- `evidence.upload`
- `evidence.view_job`
- `messaging.view_job`
- `messaging.send_job`
- `incidents.create`
- `incidents.view_job`
- `payments.view_own`
- `profile.view_self`
- `profile.edit_self`

**No debe poder**
- aprobar hitos
- liberar pagos
- reasignar jobs
- ver finanzas globales
- gestionar usuarios

---

### technician
**Módulos principales**
- dashboard
- jobs
- tasks
- evidence
- messaging
- incidents
- payments
- profile
- documents

**Permisos recomendados**
- todo lo de `helper`
- `documents.upload_own`
- `documents.view_own`
- `milestones.view`
- `milestones.submit`

**No debe poder**
- aprobar/rechazar hitos del cliente
- liberar pagos
- cambiar contratos

---

### crew_lead
**Módulos principales**
- dashboard
- jobs
- tasks
- evidence
- messaging
- incidents
- materials
- time_tracking
- payments
- profile

**Permisos recomendados**
- todo lo de `technician`
- `tasks.view_job`
- `materials.request`
- `time_tracking.view_job`
- `time_tracking.clock`
- `incidents.escalate`

**No debe poder**
- aprobar pagos
- resolver disputas
- editar settings globales

---

### subcontractor
**Módulos principales**
- dashboard
- jobs
- tasks
- evidence
- messaging
- documents
- payments
- profile

**Permisos recomendados**
- `dashboard.view_own`
- `jobs.view_assigned`
- `tasks.view_job`
- `tasks.update_status`
- `evidence.upload`
- `evidence.view_job`
- `messaging.view_job`
- `messaging.send_job`
- `documents.upload_own`
- `documents.view_own`
- `payments.view_own`
- `profile.view_self`
- `profile.edit_self`

**No debe poder**
- ver jobs ajenos
- liberar pagos
- gestionar compliance global

---

## 5.2 Clients

### residential_client
**Módulos principales**
- dashboard
- jobs
- evidence
- milestones
- payments
- documents
- messaging
- profile
- reviews

**Permisos recomendados**
- `dashboard.view_own`
- `jobs.create`
- `jobs.view_own`
- `jobs.edit_own`
- `evidence.view_job`
- `evidence.comment`
- `milestones.view`
- `milestones.approve`
- `milestones.reject`
- `milestones.request_changes`
- `payments.view_job`
- `payments.fund`
- `payments.approve_release`
- `documents.view_job`
- `messaging.view_job`
- `messaging.send_job`
- `profile.view_self`
- `profile.edit_self`
- `disputes.create`
- `disputes.view_job`

**No debe poder**
- ver jobs de otros clientes
- liberar pagos directamente como operación interna
- reasignar workforce
- editar políticas del sistema

---

### property_manager
**Módulos principales**
- dashboard
- jobs
- evidence
- milestones
- payments
- documents
- messaging
- reports
- profile
- disputes

**Permisos recomendados**
- todo lo de `residential_client`
- `reports.view_org`
- `jobs.view_own`
- `incidents.view_job`

**No debe poder**
- liberar pagos internos como finance admin
- ver cartera completa global
- gestionar usuarios del sistema

---

### commercial_client
**Módulos principales**
- dashboard
- jobs
- evidence
- milestones
- payments
- documents
- messaging
- reports
- profile
- disputes

**Permisos recomendados**
- equivalente a `property_manager`
- más énfasis en `documents.view_job`, `reports.view_org`, `payments.view_job`

**No debe poder**
- actuar como qa admin
- actuar como ops admin

---

## 5.3 Operations

### ops_admin
**Módulos principales**
- dashboard
- jobs
- tasks
- evidence
- messaging
- incidents
- milestones
- disputes
- reports
- users

**Permisos recomendados**
- `dashboard.view_group`
- `jobs.view_all`
- `jobs.create`
- `jobs.edit_all`
- `jobs.assign`
- `jobs.reassign`
- `tasks.create`
- `tasks.view_job`
- `tasks.reassign`
- `evidence.view_job`
- `evidence.comment`
- `incidents.view_job`
- `incidents.resolve`
- `incidents.escalate`
- `milestones.view`
- `milestones.create`
- `milestones.update`
- `disputes.view_job`
- `users.view`
- `reports.view_org`

**No debe poder**
- hacer conciliación financiera completa
- validar compliance legal completa si no tiene ese rol
- editar settings globales salvo super admin

---

### finance_admin
**Módulos principales**
- dashboard
- payments
- milestones
- reports
- documents
- disputes

**Permisos recomendados**
- `dashboard.view_group`
- `payments.view_job`
- `payments.release`
- `payments.reconcile`
- `milestones.view`
- `reports.view_org`
- `documents.view_job`
- `disputes.view_job`

**No debe poder**
- reasignar workforce operacional
- cambiar settings globales
- validar QA técnica como rol principal

---

### qa_admin
**Módulos principales**
- dashboard
- evidence
- milestones
- qa
- incidents
- reports

**Permisos recomendados**
- `dashboard.view_group`
- `evidence.view_job`
- `evidence.approve`
- `evidence.reject`
- `evidence.comment`
- `milestones.view`
- `milestones.approve`
- `milestones.reject`
- `milestones.request_changes`
- `qa.view`
- `qa.review`
- `qa.approve`
- `qa.reject`
- `qa.request_rework`
- `incidents.view_job`
- `reports.view_org`

**No debe poder**
- liberar pagos por sí solo si no coincide con regla financiera
- gestionar settings globales

---

### super_admin
**Módulos principales**
- todos

**Permisos recomendados**
- todos los permisos anteriores
- `users.create`
- `users.edit`
- `users.suspend`
- `users.assign_roles`
- `settings.view`
- `settings.edit_global`
- `reports.view_global`
- `compliance.validate`
- `compliance.expire`
- `disputes.assign`
- `disputes.resolve`

**Advertencia**
Este rol no debe usarse como shortcut operativo diario.
Debe reservarse para gobernanza, soporte crítico y administración superior.

---

## 6. Matriz resumida por herramienta

| Herramienta | Workforce | Clients | Operations |
|---|---|---|---|
| Dashboard | Ver resumen personal | Ver proyectos/estados | Ver operación global |
| Jobs | Ver asignados | Crear/ver propios | Crear/asignar/editar todos |
| Tasks | Ejecutar/actualizar | Ver progreso general | Crear/reasignar/supervisar |
| Evidence | Subir evidencia | Ver/comentar | Revisar/aprobar/rechazar |
| Messaging | Comunicación de campo | Comunicación de proyecto | Coordinación y soporte |
| Milestones | Ver/submit | Aprobar/rechazar | Crear/controlar/cerrar |
| Payments | Ver pagos propios | Fondear/aprobar | Liberar/conciliar/auditar |
| Documents | Subir/ver propios | Ver contratos/invoices | Validar/archivar |
| Incidents | Reportar | Ver incidencias propias | Resolver/escalar |
| QA | Ver observaciones | Ver resultado | Revisar/aprobar/retrabajo |
| Compliance | Subir docs propios | Ver contratos aplicables | Validar seguros/licencias |
| Disputes | Abrir caso | Abrir caso | Resolver caso |
| Reports | Productividad personal | Reportes propios | Métricas completas |
| Users | No | No | Sí |
| Settings | Perfil básico | Perfil básico | Sistema global |

---

## 7. Reglas críticas de implementación

### Regla 1 — Módulo primero, rol después
No asignar permisos sueltos sin anclarlos a un módulo.

### Regla 2 — Ownership antes que rol
Aunque un rol permita una acción, si no existe ownership/alcance válido, la acción debe bloquearse.

### Regla 3 — Aprobar no siempre implica liberar pago
`qa_admin` y `client` pueden aprobar evidencia o milestone, pero la liberación de fondos debe seguir reglas financieras separadas.

### Regla 4 — Super admin no es shortcut de producto
No usar `super_admin` para evitar modelar bien permisos intermedios.

### Regla 5 — Clients no ven internals innecesarios
Los clientes solo ven su contexto, no operación interna completa.

### Regla 6 — Workforce no toca finanzas estructurales
Puede ver sus pagos, pero no liberar fondos ni cambiar contratos.

---

## 8. Recomendación para implementación técnica

## Frontend
Usar esta matriz para:
- sidebars por grupo;
- módulos visibles por rol;
- botones/acciones condicionados;
- vistas diferenciadas por toolkit.

## Backend
Usar esta matriz para:
- guards RBAC;
- policies por acción;
- ownership checks;
- auditoría de permisos sensibles.

## Base de datos
Modelo sugerido:
- `users`
- `organizations`
- `memberships`
- `roles`
- `permissions`
- `role_permissions`
- `user_role_assignments`

---

## 9. Siguiente paso recomendado

Convertir esta matriz en dos artefactos complementarios:

1. `SEMSE_ROLE_MODEL.md`
   - definición de grupos y roles
2. `SEMSE_NAVIGATION_MATRIX.md`
   - qué menú, dashboard y módulos ve cada grupo/rol

Eso conectará esta matriz con frontend, backend y experiencia real del producto.
