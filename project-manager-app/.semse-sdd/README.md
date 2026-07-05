# SEMSEproject — Spec-Driven Development Kit

**Propósito:** Este kit convierte la visión modular de SEMSEproject en un proceso operativo para Codex, Claude, Cursor o cualquier agente de programación.

El objetivo no es “programar por intuición”. El objetivo es que cada cambio tenga:

1. **Spec** — qué se va a construir y por qué.
2. **Plan técnico** — cómo se implementa sin romper producción.
3. **Tasks** — pasos pequeños y verificables.
4. **Acceptance criteria** — condiciones objetivas para aceptar el cambio.
5. **Validation** — comandos que deben pasar antes de PR/deploy.
6. **Railway/GitHub green path** — flujo para dejar main estable.

---

## Uso rápido para Codex

1. Copia este kit dentro del repo:

```bash
cp -R semse_sdd_kit .semse-sdd
```

2. Abre el prompt:

```txt
prompts/00_codex_start_here.txt
```

3. Ejecuta primero auditoría, no refactor:

```txt
prompts/01_codex_audit_repo.txt
```

4. Implementa una fase a la vez:

```txt
prompts/02_codex_apply_admin_modular_nav.txt
```

5. Valida antes de PR:

```bash
bash .semse-sdd/scripts/validate_web.sh
bash .semse-sdd/scripts/sdd_guardrails.sh
```

---

## Resultado esperado

Después de aplicar este kit, SEMSEproject debe quedar organizado como ecosistema modular:

- Mission Control
- WorkOps
- Marketplace
- Finance
- Trust
- Intelligence
- Tool Hub
- Verticals
- Settings

Sin romper rutas existentes, sin cambios destructivos de Prisma y sin mezclar refactors masivos con features nuevas.

