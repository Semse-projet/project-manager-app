# Checklist P0

- [x] Slice independiente, sin cambios de base de datos.
- [x] El camino AUDIO sin texto ni binding rechaza 400.
- [x] HttpUrlStorageReader legacy no efectúa fetch.
- [x] Tests rechazan URLs locales, metadata, CDN y URL signed aparente.
- [x] Text manual funciona y no llama transcriptor.
- [ ] Coverage, unit, API build, E2E, index y spec:validate:strict en CI.
- [ ] Autenticación multi-farm validada en staging.
- [ ] Aprobación de merge y aceptación de degradación temporal.
- [ ] Evidencia de deploy/activación y smoke real antes de VERIFIED.
