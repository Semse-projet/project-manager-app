# SEMSE Role Model

## Canonical groups

### Workforce
The productive and technical force that executes the work.

### Clients
The demand side that originates work, funds it and validates outcomes.

### Operations
The coordination, control, compliance, finance, quality and dispute layer.

## MVP roles

### Workforce
- helper
- technician
- crew_lead
- subcontractor

### Clients
- residential_client
- property_manager
- commercial_client

### Operations
- ops_admin
- finance_admin
- qa_admin
- super_admin

## Role model rule

Model access in this order:
- group;
- role;
- toolkit;
- module;
- action.

Never skip directly from user to random permission checks when a role/toolkit layer is more stable.
