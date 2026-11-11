/** The public auth pages offer ES/EN and keep every visible string in their COPY catalogs. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

const PAGES: Record<string, { file: string; form: string }> = {
  login: { file: "apps/web/app/login/page.tsx", form: "LoginForm" },
  register: { file: "apps/web/app/register/page.tsx", form: "RegisterForm" },
  "forgot-password": { file: "apps/web/app/forgot-password/page.tsx", form: "ForgotPasswordForm" },
  "reset-password": { file: "apps/web/app/reset-password/page.tsx", form: "ResetPasswordShell" },
};

function catalogKeys(source: string, lang: "es" | "en"): string[] {
  const block = source.split(`  ${lang}: {\n`)[1]?.split("\n  },")[0];
  assert.ok(block, `COPY.${lang} must exist`);
  return [...block.matchAll(/^\s{4}(\w+):/gm)].map((match) => match[1]).sort();
}

// Any of these left in the page outside COPY means a string skipped translation.
const SPANISH = [
  "Iniciar sesión", "Contraseña", "contraseña", "Ingresar", "Olvidé", "Crear cuenta", "Entrar como", "No se pudo",
  "Volver al login", "Ir al login", "Correo enviado", "Enlace inválido", "Cargando", "Repite", "Mínimo", "Tipo de cuenta",
  "Nombre", "Muy débil",
];

for (const [name, { file, form }] of Object.entries(PAGES)) {
  test(`${name}: COPY.es and COPY.en have the same keys`, () => {
    const source = read(file);
    assert.deepEqual(catalogKeys(source, "en"), catalogKeys(source, "es"));
  });

  test(`${name}: wrapped in LanguageProvider with the shared language switch`, () => {
    const source = read(file);
    assert.match(source, new RegExp(`<LanguageProvider>\\s*<${form} />\\s*</LanguageProvider>`));
    assert.match(source, /<LanguageSwitch \/>/);
    assert.match(source, /from "\.\.\/_auth\/LanguageSwitch"/);
  });

  test(`${name}: no visible Spanish text outside COPY, no API error text shown`, () => {
    const source = read(file);
    const outsideCopy = source.replace(/const COPY = \{[\s\S]*?\n\} as const;/, "");
    for (const literal of SPANISH) {
      assert.ok(!outsideCopy.includes(literal), `"${literal}" must come from COPY`);
    }
    assert.doesNotMatch(source, /data\.error/, "the APIs answer in Spanish; pick the copy by status instead");
  });
}

test("login picks its error copy by status", () => {
  const page = read(PAGES.login.file);
  assert.match(page, /if \(status === 401\) return "invalidCredentials";/);
  assert.match(page, /if \(status === 429\) return "tooManyAttempts";/);
  assert.match(page, /setError\(loginErrorKey\(res\.status\)\)/);
});

test("the shared switch exposes its state to assistive tech", () => {
  const sw = read("apps/web/app/_auth/LanguageSwitch.tsx");
  assert.match(sw, /role="group"/);
  assert.match(sw, /aria-pressed=\{active\}/);
  assert.match(sw, /setLanguage\(value\)/);
});

test("the strength meter is translated in both languages", () => {
  const meter = read("apps/web/app/_auth/PasswordStrength.tsx");
  assert.match(meter, /es: \["Muy débil", "Débil", "Regular", "Fuerte", "Muy fuerte"\]/);
  assert.match(meter, /en: \["Very weak", "Weak", "Fair", "Strong", "Very strong"\]/);
});
