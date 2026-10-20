# Revisión de los 16 textos críticos ES/EN

Estado: **PENDIENTE DE APROBACIÓN HUMANA**, no modificar reviewer/status por esta hoja. Contratos v0.2 ya aprobados; esta revisión corresponde al texto exacto, consecuencias de acciones y glosario. No se solicita volver a votar OPEN-03/04/06/14.

Fuente: UI de #1018; checkpoint inicial 25cbd26ec4459021827073351ed0d49e94d954b9. Las cadenas no cambian con el arreglo posterior de Redis. Ver critical-translations.json para hashes completos y metadatos.

| Clave | Español exacto | English exact | Consecuencia que debe conservar |
|---|---|---|---|
| invitations:intro | Invita a un trabajador por correo. Su acceso solo se crea cuando él acepta con su propia cuenta. | Invite a worker by email. Access is only created after they accept with their own account. | Invitar no crea acceso; el destinatario debe aceptar con su propia cuenta. |
| invitations:invite | Invitar | Invite | Crear/enviar invitación WORKER; no crear cuenta ni membresía activa. |
| invitations:cancel | Cancelar | Cancel | Cancelar invitación pendiente con motivo real; no suspender una membresía existente. |
| invitations:link | Enlace de invitación (se muestra una sola vez) | Invitation link (shown only once) | Secreto visible una sola vez al emisor solo si entrega email está desactivada. |
| accept:invited | {company} te invitó como trabajador. | {company} invited you as a worker. | Nombre de empresa interpolado como texto; invitación para rol WORKER. |
| accept:accept | Aceptar invitación | Accept invitation | Aceptar con cuenta del destinatario verificada por backend; sin autoaceptación. |
| accept:create | Crear cuenta y unirme | Create account and join | Crear cuenta nueva y aceptar invitación solo bajo flags de registro y entrega por email. |
| accept:done | Listo. Ya formas parte de la empresa. | Done. You are now part of the company. | Confirmación posterior a respuesta exitosa; no equivale a engagement ni contrato. |
| accept:invalid | Esta invitación no es válida, venció o es para otra cuenta. | This invitation is invalid, expired, or meant for another account. | Error neutro; no revelar existencia de cuenta o causa sensible. |
| offers:intro | Una oferta no es un contrato ni da acceso por sí sola. La persona la acepta y después tú confirmas el engagement. La relación laboral o contractual la defines fuera de SEMSE; confirma con tu asesor legal. | An offer is not a contract and grants no access by itself. The person accepts it and then you confirm the engagement. You define the employment or contractor relationship outside SEMSE; confirm it with your legal advisor. | Oferta y engagement no equivalen a contrato/firma ni conceden Membership. Revisar término engagement en glosario. |
| offers:compensation | Nota de compensación (solo gestores autorizados y destinatario) | Compensation note (authorized managers and recipient only) | Solo owner verificado/OPS_ADMIN autorizado y destinatario; supervisor y otros CLIENT quedan excluidos. |
| offers:send | Enviar oferta | Send offer | Emitir oferta; no aceptar por el destinatario ni activar relación. |
| offers:revoke | Revocar | Revoke | Revocar oferta pendiente; no borrar historial ni revocar accesos. |
| offers:confirm | Confirmar engagement | Confirm engagement | Pasar engagement aceptado de PENDING_CONFIRMATION a ACTIVE con legalConfirmed:true; sin firma ni nuevo acceso. |
| offers:legal | Confirmo que revisé las obligaciones legales aplicables | I confirm I reviewed the applicable legal obligations | Declaración del gestor, no certificación legal ni sustituto de revisión jurídica. |
| offers:end | Terminar engagement | End engagement | Terminar engagement permitido con motivo real; no cambiar Membership/pagos/otras organizaciones. |

## Criterio de aprobación

Revisar estas cadenas y el significado en su pantalla. Registrar revisor autorizado, fecha UTC, evidencia de aprobación, versión de glosario y hashes actuales. No deducir aprobación de «Continúa», del contrato, del CI ni de una revisión de IA. Si se propone una corrección, modificar ambas cadenas y generar otra hoja/hashes antes de aprobarla.

El término engagement se mantiene como en la UI actual; su denominación de producto en español requiere decisión de glosario. La declaración legal del gestor no acredita por sí sola la legalidad de una contratación. Una revisión lingüística o de producto tampoco sustituye el gate jurídico exigido para uso real.
