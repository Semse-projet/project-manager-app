# Checklist — BO-01
- [ ] Tests rojos registrados antes del código.
- [ ] Token nunca en GET, logs ni auditoría.
- [ ] Cross-org y cross-tenant → 404.
- [ ] Concurrencia de aceptación: una Membership.
- [ ] Flag apagado → 404 sin efectos.
- [ ] spec:validate:strict, build, typecheck, tests.
- [ ] CI verde en el SHA del PR.
- [ ] Migración verificada para `db push` en Railway.
- [ ] Canary A/B sintético antes de activar el flag.
