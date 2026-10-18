# Plan — BO-12 skills
- Base: main tras BO-10. Aditivo: `SkillExperience` y `SkillAttestation`; no toca `TaskAllocation` ni `JobTask`.
- Módulo propio `skills`; el cálculo es una función pura sin niveles.
- Todo tras `SEMSE_SKILLS_ENABLED` (apagado → 404).
- Rollback: apagar el flag; las tablas pueden quedar sin uso. Las atestaciones emitidas se pueden revocar.
