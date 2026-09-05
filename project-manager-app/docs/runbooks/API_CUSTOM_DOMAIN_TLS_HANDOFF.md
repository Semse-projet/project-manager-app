# Cierre de incidente — `api.semseproject.com` DNS/TLS

**Estado:** RESUELTO
**Corte técnico:** 2026-07-31
**Resultado:** el hostname público API valida TLS estricto y responde health
200. Este archivo conserva la cronología y el hardening administrativo
pendiente.

## Contexto del dominio

Datos confirmados por el owner en Florida Registered Agent:

| Campo | Valor |
|---|---|
| Dominio | `semseproject.com` |
| Estado / plan | Active / Active |
| Registrado a | SEMSEPROJET L.L.C. |
| Registro | 2026-02-21 |
| Expiración | 2027-02-21 |
| Registrar lock | Off |
| SSL | Included |
| Parking | Off |
| IP | Shared |

Ruta operativa: portal de Florida Registered Agent → Web Services → Domains →
`semseproject.com`. No registrar contraseñas, cookies ni códigos MFA en este
archivo.

Durante la sesión inicial, el inicio de sesión integrado mostró:

> Es posible que el navegador o la aplicación no sean seguros.

El acceso posterior se completó en un navegador normal compatible. El mensaje
era un bloqueo del flujo de login integrado, no evidencia de un problema DNS.

## Estado inicial observado

DNS público:

```text
api.semseproject.com CNAME 2611i99q.up.railway.app
app.semseproject.com CNAME d9w538n7.up.railway.app
semseproject.com NS ns1.hosting.businessidentity.llc
semseproject.com NS ns2.hosting.businessidentity.llc
```

Railway:

- API service domain
  `project-manager-app-production-977f.up.railway.app`, health 200.
- Custom domain `api.semseproject.com`, target port 3000, sync reportado
  `ACTIVE`.
- Web custom domain `app.semseproject.com`, health 200.
- El hardening de dominios/demo auth de PR `#480` está mergeado y desplegado en
  los cuatro servicios como `3c2ac45d`; el TLS/404 API persistió después de ese
  deployment.

Pruebas iniciales:

```text
https://project-manager-app-production-977f.up.railway.app/v1/health -> 200
https://app.semseproject.com/api/semse/healthz                   -> 200
https://api.semseproject.com/v1/health, TLS estricto             -> fallo de nombre de certificado
https://api.semseproject.com/v1/health, sin verificar TLS        -> 404
```

En ese corte el CNAME llegaba a Railway, pero el edge no servía correctamente
el host API ni su certificado. Ese hallazgo demostró que `ACTIVE`, por sí solo,
no era criterio suficiente de aceptación.

## Resolución verificada

Después del merge de PR `#481` y del Railway Deploy workflow `30597913257`:

- `origin/main` y los cuatro servicios quedaron en
  `114cb9ca4007d32bf3fbbfc9c36d54b1e862236a`.
- API `575a82f1-ac99-4d60-a5d2-e6aeb645e096`, Web
  `3ffb51d5-6dd1-4fd3-afa2-b7c6b1cff489`, Worker
  `8fe3b3fc-c10a-4843-82cf-d4a2e79297ec` y Vision
  `bf804e3b-9a56-4b94-b1ad-6e6bcafd57cd` terminaron `SUCCESS`.
- Railway siguió reportando `api.semseproject.com` `ACTIVE` sobre el puerto
  3000.

Pruebas finales:

```text
https://project-manager-app-production-977f.up.railway.app/v1/health -> 200, TLS estricto
https://api.semseproject.com/v1/health                             -> 200, TLS estricto
https://app.semseproject.com/api/semse/healthz                     -> 200, TLS estricto
https://semse-web-production.up.railway.app/api/semse/healthz      -> 200, TLS estricto
```

El estado actual cumple el criterio técnico. La emisión se completó después de
alinear el target port y desplegar nuevamente, pero no se observó el mecanismo
interno de Railway; esa secuencia es correlación temporal, no una causa raíz
demostrada.

## Procedimiento conservado para recurrencia

1. Capturar/exportar los registros DNS actuales antes de modificar.
2. Abrir en Railway el custom domain del servicio API y copiar el CNAME target
   actual; compararlo carácter por carácter con el portal DNS.
3. Confirmar que `api` tenga un solo CNAME y ningún A/AAAA/forwarding
   conflictivo.
4. Revisar CAA en el panel DNS. Si existe, confirmar que permita la CA usada por
   Railway.
5. Si Railway muestra un target distinto, actualizar sólo el CNAME `api`.
6. Si target y DNS coinciden pero el certificado sigue incorrecto, reprovisionar
   el custom domain desde Railway en una ventana controlada; no tocar
   `app.semseproject.com`.
7. Esperar propagación/emisión y repetir pruebas estrictas.

No usar `curl -k` como aceptación ni publicar un proxy alterno permanente.

## Criterio de cierre

- [x] `curl https://api.semseproject.com/v1/health` valida TLS y responde 200.
- [x] El certificado es válido para `api.semseproject.com`.
- [x] Railway domain sigue `ACTIVE` y el dominio Railway directo permanece 200.
- [x] Web custom domain permanece 200.
- [x] El cambio y rollback quedan registrados sin secretos.

## Hardening administrativo pendiente

El registrar lock sigue `Off`. Habilitarlo en una sesión administrativa
dedicada después de confirmar el procedimiento de desbloqueo/rollback con el
registrador. El lock reduce el riesgo de transferencia no autorizada, pero no
participa en la resolución DNS ni TLS y no reabre este incidente técnico.
