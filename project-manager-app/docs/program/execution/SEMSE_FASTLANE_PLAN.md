# SEMSE Fastlane Plan

## Fecha
2026-03-15

## Proposito

Acelerar SEMSE sin abrir mas caos.

La meta no es hacer mas cosas a la vez por ansiedad.
La meta es cerrar un MVP demostrable mas rapido con:
- una sola fuente de verdad;
- trabajo en paralelo bien dividido;
- checkpoints cortos;
- menos expansion de scope;
- mas integracion y mas pruebas.

---

## 1. Objetivo de 14 dias

En los proximos 14 dias, SEMSE debe llegar a una demo interna clara con este circuito:

1. crear job;
2. abrir job detail;
3. crear milestone;
4. registrar evidencia;
5. submit / approve / request changes / reject;
6. fondear escrow;
7. release de milestone aprobado;
8. abrir disputa;
9. resolver disputa.

Regla:
- demoable > perfecto.
- integrado > elegante.
- coherente > ambicioso.

---

## 2. Fuente de verdad

### Vision oficial
- `~/labsemse/vision`

### Programa oficial
- `~/labsemse/program`

### Core tecnico canónico
- `~/labsemse/project-manager-app`

### Workspace de direccion
- `/home/yoni/.openclaw/workspace`

### Prohibicion operativa
No crear nuevas piezas activas fuera del core canónico.
No abrir trabajo nuevo en `Descargas` ni en prototipos sueltos.

---

## 3. Regla de velocidad

Para avanzar mas rapido, toda tarea debe pasar esta prueba:

### Pregunta 1
Esto acerca el MVP demoable en los proximos 14 dias?

### Pregunta 2
Esto reduce friccion o incoherencia del flujo real?

### Pregunta 3
Esto puede completarse y probarse en <= 1 dia de trabajo concentrado?

Si la respuesta es no:
- se mueve al backlog posterior.

---

## 4. Estructura de trabajo por carriles

## Carril A — Core Runtime
Responsable de:
- dominio;
- estados;
- endpoints;
- permisos;
- invariantes;
- transicion Job-first.

### KPI
- menos estados ambiguos;
- menos puentes innecesarios por `projectId`;
- mas coherencia release/dispute/review.

---

## Carril B — Product Shell
Responsable de:
- `apps/web`;
- flujos visibles;
- navegacion;
- feedback;
- coherencia UX.

### KPI
- demo navegable de punta a punta;
- errores entendibles;
- menos pantallas “tecnicas”.

---

## Carril C — QA / Smoke
Responsable de:
- smoke tests;
- checklist de demo;
- deteccion de regresiones;
- validacion del circuito visible.

### KPI
- happy path corrido sin romperse;
- exception path corrido sin romperse;
- fallos clasificados rapido.

---

## Carril D — PM / Integracion
Responsable de:
- scope;
- priorizacion;
- integracion de trabajo paralelo;
- status;
- decisiones de corte.

### KPI
- menos trabajo abandonado a medias;
- menos expansion de scope;
- backlog vivo y ejecutable.

---

## 5. Secuencia de ejecucion recomendada

## Fase 1 — Cierre del circuito visible
**Duracion sugerida:** 3 a 5 dias

### Objetivo
Hacer el circuito actual verdaderamente demoable.

### Entra
- pulido de job detail;
- milestones shell;
- better release feedback;
- disputa visible + resolve visible;
- evidence / escrow consistency;
- smoke inicial.

### No entra
- trust avanzado;
- supply-side complejo;
- agenda completa;
- create job rico con todos los campos.

### Definition of done
- el circuito visible puede correrse sin pasos manuales absurdos;
- los estados mas importantes se entienden desde UI;
- los errores principales no rompen la demo.

---

## Fase 2 — Harden del runtime
**Duracion sugerida:** 2 a 4 dias

### Objetivo
Corregir lo que rompa el flujo visible al probarlo.

### Priorizacion
1. review loop
2. release path
3. dispute path
4. audit trail minimo
5. naming visible coherente

### Definition of done
- los fallos de smoke principales quedan corregidos;
- no quedan inconsistencias graves entre UI y runtime.

---

## Fase 3 — Demo build
**Duracion sugerida:** 1 a 2 dias

### Objetivo
Preparar una version interna presentable.

### Entregables
- checklist de demo;
- script o instrucciones de arranque;
- rutas principales documentadas;
- orden sugerido de demo;
- lista corta de riesgos conocidos.

---

## 6. Top prioridades (orden estricto)

## P0
1. smoke del circuito visible
2. feedback visual mejor de release
3. disputa create/resolve estable desde shell
4. milestones state clarity
5. correccion de errores de wiring/regresion

## P1
6. job detail mas limpio y expresivo
7. filtrado de disputes por contexto real
8. payments / ledger visible por job
9. post-release status clarity (`approved` -> `paid` o equivalente visible)
10. checklist de demo

## P2
11. create job con mas campos
12. trust signals visibles
13. ops console mas rica
14. supply-side shell
15. scheduling

---

## 7. Lo que NO se hace ahora

No abrir ahora:
- Prometeo completo;
- wallets;
- DAO;
- antifraude sofisticado;
- arquitectura nueva paralela;
- refactors grandes sin impacto directo en demo;
- UI cosmética sin resolver flujo.

---

## 8. Modelo de trabajo diario

Cada jornada debe cerrar 4 puntos:

### 1. Cierres del dia
Que quedo realmente terminado?

### 2. Parciales del dia
Que quedo a medio hacer y por que?

### 3. Bloqueos
Que impide seguir rapido?

### 4. Siguiente movimiento
Que es lo siguiente que maximiza progreso demostrable?

---

## 9. Modelo de paralelizacion

Para acelerar sin romper:

### Regla 1
Paralelizar por carriles, no por archivos mezclados.

### Regla 2
Si hay varios agentes, trabajar sobre copias temporales o worktrees si el arbol principal esta muy caliente.

### Regla 3
El integrador decide que entra al core.
No todo lo que produzca un lane se fusiona directo.

### Regla 4
Cada lane debe tener:
- alcance;
- no tocar;
- definition of done;
- output esperado.

---

## 10. Plan inmediato de 72 horas

## Bloque A — Hoy
- consolidar shell visible;
- resolver wiring pendiente;
- dejar release/dispute funcionando desde producto;
- monitorear lanes paralelos de smoke y UI polish.

## Bloque B — Proximas 24 horas
- integrar hallazgos de smoke;
- corregir errores de circuito visible;
- limpiar estados y feedback;
- preparar checklist de demo.

## Bloque C — Proximas 48-72 horas
- correr demo interna completa;
- registrar fallos;
- corregir P0;
- preparar build interna demostrable.

---

## 11. Checklist de demo objetivo

La demo debe poder mostrar:

- dashboard
- create job
- job detail
- create milestone
- register evidence
- request changes / reject / approve
- fund escrow
- release
- open dispute
- resolve dispute

Si una parte no esta lista, debe saberse antes de la demo y no durante la demo.

---

## 12. Definition of success

Este fastlane funciona si en 14 dias existe:

- un circuito demoable sin improvisacion;
- una narrativa clara del producto;
- un repo principal comprensible;
- menos deuda de flujo abierto;
- y una base real para Sprint 2.

---

## 13. Siguiente accion recomendada

Siguiente accion operativa inmediata:
- esperar y revisar resultados de los lanes paralelos ya lanzados;
- integrar solo lo que mejore smoke o shell visible;
- luego abrir una checklist corta de demo interna.

### Mandato final
No perseguir mas amplitud.
Perseguir cierre.

SEMSE ya no necesita mas identidad.
Necesita mas integracion, mas prueba y mas finish.
