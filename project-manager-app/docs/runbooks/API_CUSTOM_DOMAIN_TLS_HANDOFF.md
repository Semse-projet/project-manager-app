# Handoff — `api.semseproject.com` DNS/TLS

**Estado:** PENDIENTE, sesión dedicada
**Corte técnico:** 2026-07-31
**Impacto:** el API funciona por dominio Railway; el hostname público API no es
apto para clientes con TLS estricto.

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

Durante la sesión anterior, el inicio de sesión integrado mostró:

> Es posible que el navegador o la aplicación no sean seguros.

Para la siguiente sesión, abrir el portal en un navegador normal compatible y
completar login/MFA manualmente. El mensaje es un bloqueo del flujo de login,
no evidencia de un problema DNS.

## Estado observado

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

Pruebas:

```text
https://project-manager-app-production-977f.up.railway.app/v1/health -> 200
https://app.semseproject.com/api/semse/healthz                   -> 200
https://api.semseproject.com/v1/health, TLS estricto             -> fallo de nombre de certificado
https://api.semseproject.com/v1/health, sin verificar TLS        -> 404
```

El CNAME llega a Railway, pero el edge no está sirviendo correctamente el host
API ni su certificado. No marcar el dominio como resuelto sólo porque Railway
muestre `ACTIVE`.

## Siguiente sesión

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
8. Después de estabilizar, habilitar registrar lock como hardening del dominio;
   el lock no corrige DNS/TLS.

No usar `curl -k` como aceptación ni publicar un proxy alterno permanente.

## Criterio de cierre

- `curl https://api.semseproject.com/v1/health` valida TLS y responde 200.
- El certificado incluye `api.semseproject.com` en SAN.
- Railway domain sigue `ACTIVE` y el dominio Railway directo permanece 200.
- Web custom domain permanece 200.
- El cambio y rollback quedan registrados sin secretos.
