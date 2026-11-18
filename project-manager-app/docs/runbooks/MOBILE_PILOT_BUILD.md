# Build de piloto móvil (Expo/EAS) — Motorola y dos iPhone

> Estado: preparado el 2026-11-18. **Nada de esto se ha ejecutado contra Expo ni Apple**: requiere las sesiones
> personales del propietario (marcadas con 🔐). Este runbook no contiene secretos ni los pide; los valores sensibles
> se cargan directamente en EAS por el propietario.

## 0. Qué cambia en este PR y por qué

- **Perfil `pilot` en `apps/mobile/eas.json`:** distribución interna (APK en Android; ad hoc en iOS), sin URL
  fija en el repo. Toma las variables del entorno EAS **`preview`** y marca `EXPO_PUBLIC_SEMSE_APP_ENV=pilot`.
- **Doble barrera contra producción:**
  1. `apps/mobile/scripts/check-build-env.mjs` (hook `eas-build-pre-install`): con el perfil `pilot`, el build
     **se detiene antes de compilar** si falta la URL del API, si no es HTTPS o si apunta a `api.semseproject.com`.
  2. `src/config/environment.ts`: con `EXPO_PUBLIC_SEMSE_APP_ENV=pilot`, la app **no arranca** sin URL explícita
     o con la URL de producción (no hay *fallback* a producción). Tests en `environment.test.ts`.
- Los perfiles `development`, `preview` y `production` **no cambian** (siguen apuntando a producción). No usar
  `preview` ni `development` para el piloto.

## 1. Requisitos

| Requisito | Quién | Estado |
|---|---|---|
| Cuenta Expo con acceso a la organización `semseproject.com` (dueña del proyecto `718f27b3-c5b9-4f5c-a695-94fd3f85a5c7`) | 🔐 propietario | pendiente |
| Apple Developer Program **de pago** (necesario para builds ad hoc en iPhone físicos) y rol Admin/App Manager | 🔐 propietario | pendiente |
| Bundle ID `com.semse.mobile` disponible en esa cuenta Apple | 🔐 propietario | sin verificar |
| API de staging con URL HTTPS pública y su base de datos aislada (ver §5) | propietario autoriza | **no existe aún** |
| Clave publicable de Stripe **de prueba** (`pk_test_…`) | 🔐 propietario | pendiente |
| Node 22 y pnpm 10.33.0 en la máquina desde la que se lanza el build | quien ejecute | — |

## 2. Inicio de sesión (🔐 solo el propietario, en su propia terminal)

```bash
cd project-manager-app/apps/mobile
npx eas-cli@latest login          # 🔐 usuario y contraseña de Expo, o SSO; nunca en el chat
npx eas-cli@latest whoami         # debe mostrar una cuenta con acceso a semseproject.com
```

Para un agente o CI sin sesión interactiva, la alternativa es un **token de acceso de Expo** creado por el
propietario en expo.dev → *Account settings → Access tokens* y guardado como secreto (`EXPO_TOKEN`) en el entorno
que lo use. **No pegarlo en el chat ni en el repo.**

## 3. Variables del entorno EAS `preview` (🔐 propietario, una vez)

```bash
# URL del API de staging (la decide §5). Visibilidad "plaintext": es pública en el bundle.
npx eas-cli@latest env:set --environment preview --name EXPO_PUBLIC_SEMSE_API_BASE_URL \
  --value "https://<api-de-staging>" --visibility plaintext

# Clave publicable de Stripe en modo prueba (pk_test_…). Es pública por diseño (va dentro del bundle), pero no debe
# ser la de producción. Las variables EXPO_PUBLIC_* no pueden tener visibilidad "secret": EAS no las incrusta.
npx eas-cli@latest env:set --environment preview --name EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY \
  --value "pk_test_..." --visibility sensitive

npx eas-cli@latest env:list --environment preview   # comprobar; no imprime valores sensibles
```

**Separación staging/producción:** las variables de producción viven solo en el entorno EAS `production` y en el
perfil `production`. El perfil `pilot` nunca lee el entorno `production`, y las barreras del §0 bloquean la URL de
producción aunque alguien la cargue por error en `preview`.

## 4. Builds

### Android (Motorola) — sin cuenta de Google Play

```bash
npx eas-cli@latest build --platform android --profile pilot
```
El build produce un APK; EAS da un enlace/QR. En el Motorola: abrir el enlace, permitir «instalar apps de origen
desconocido» para el navegador, instalar.

### iOS (dos iPhone) — ad hoc

```bash
# 1) Registrar cada iPhone (genera un enlace/QR que se abre EN el iPhone e instala un perfil). Repetir por equipo.
npx eas-cli@latest device:create                    # 🔐 inicia sesión en Apple Developer si no hay credenciales

# 2) Build ad hoc. EAS pedirá iniciar sesión en Apple (🔐 Apple ID + 2FA) para crear o reutilizar el
#    certificado de distribución y el perfil de aprovisionamiento con los UDID registrados.
npx eas-cli@latest build --platform ios --profile pilot
```
Si se registra un iPhone **después** del build, hay que reconstruir (el perfil ad hoc incluye los UDID).
En iOS 16+ cada iPhone debe activar *Ajustes → Privacidad y seguridad → Modo de desarrollador* para abrir la app.

### Qué verificar en el log de EAS antes de instalar
- `[check-build-env] pilot build: staging API origin accepted.` — si aparece `pilot build blocked`, el build se
  detuvo a propósito: corregir la variable, nunca el script.

## 5. Staging: inventario real de Railway (lectura, 2026-11-18)

| Proyecto Railway | Entorno | Servicios relevantes | Código | URL pública del API | Valoración |
|---|---|---|---|---|---|
| SEMSEproject | `production` | semse-API, semse-web, semse-worker, semse-vision | `main` | `api.semseproject.com` | **Producción. No usar para el piloto.** |
| SEMSE AgentRun 1149 Isolated QA | `staging` | semse-api-qa, semse-worker-qa, postgres-qa, redis-qa | `main` (último deploy 2026-11-14) | **ninguna** (solo red privada) | **Mejor candidato**: aislado, API + worker, código de `main`. Falta dominio público y verificación. |
| project-manager-app | `production` (nombre engañoso; es QA) | semse-qa-api, semse-qa-web, Postgres, Redis | rama `fix/bo01-bo05-security-i18n-20261020` (SHA `7adb762`) | `semse-qa-api-production.up.railway.app` | Obsoleto (octubre) y desplegado desde una rama; reporta `environment: production`. No apto sin redeploy. |
| SEMSE T008 Staging / SEMSE PR987 P0 Isolated Staging | `staging` | APIs de pruebas puntuales | ramas de PR | — | Específicos de otras validaciones; no reutilizar. |

**Propuesta (no ejecutada; requiere autorización):** reutilizar *SEMSE AgentRun 1149 Isolated QA* como staging del
piloto: (1) generar un dominio Railway para `semse-api-qa`; (2) confirmar que despliega el SHA de `main` vigente y que
sus migraciones están aplicadas en `postgres-qa`; (3) verificar que `AUTH_SECRET` está definido y que
`SEMSE_ALLOW_HEADER_IDENTITY` **no** está activo; (4) sembrar una organización de piloto con datos sintéticos;
(5) activar en ese entorno, y solo en él, los flags del piloto (`SEMSE_GEOFENCE_POLICY_ENABLED`, cuadrillas) cuando
el propietario lo autorice. Ninguna de estas acciones toca el proyecto de producción.

## 6. Gate 5 (geofence BO-09) — sigue abierto

Las pruebas de dispositivo **no se han hecho**. Gate 5 solo se cierra con evidencia real en el Motorola y en ambos
iPhone (permisos de ubicación en primer y segundo plano, modos ASK/AUTO/OFF, consentimiento y revocación, arranque
y navegación de la app con React 19.3 sobre Fabric de RN 0.86.3). Un simulador o `expo export` no cuentan.
