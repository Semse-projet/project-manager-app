#!/usr/bin/env node
/**
 * Guardia forward-only de releases (propuesta C3/T5, incidente 9e2f87f1).
 *
 * Decide si el SHA candidato (CI verde) puede desplegarse sobre lo que sirve
 * producción. Con CI por SHA (C2), varios CI de main corren en paralelo y pueden
 * terminar FUERA DE ORDEN: un CI antiguo que termina tarde no debe desplegar un
 * SHA obsoleto sobre uno más reciente.
 *
 * Reglas (fail closed):
 *   served desconocido / no hex de 40   -> blocked
 *   served == candidate                 -> already_served (no se dispara build; se verifica)
 *   candidate es ancestro de served     -> superseded     (producción ya va por delante)
 *   served es ancestro de candidate     -> deploy         (avance lineal)
 *   cualquier otro caso (divergente)    -> blocked
 * Un rollback (ir hacia atrás) NO pasa por aquí: requiere el flujo de rollback
 * con autorización específica.
 *
 * Uso CLI (en un checkout con historia completa de main):
 *   node scripts/release-forward-guard.mjs --candidate=<sha> --served=<sha|unknown>
 * Salida: JSON {action, reason} en stdout. Exit 0 para deploy/already_served/
 * superseded, 3 para blocked, 2 para uso incorrecto.
 */
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const SHA = /^[0-9a-f]{40}$/;

export function decideRelease({ candidate, served, isAncestor }) {
  const c = String(candidate ?? "").toLowerCase();
  const s = String(served ?? "").toLowerCase();
  if (!SHA.test(c)) return { action: "blocked", reason: `candidato inválido: '${candidate}'` };
  if (!SHA.test(s)) return { action: "blocked", reason: `SHA servido desconocido ('${served}'): no se puede probar avance lineal` };
  if (s === c) return { action: "already_served", reason: "producción ya sirve el candidato" };
  if (isAncestor(c, s)) return { action: "superseded", reason: `producción sirve ${s}, posterior al candidato` };
  if (isAncestor(s, c)) return { action: "deploy", reason: `avance lineal ${s} -> ${c}` };
  return { action: "blocked", reason: `historias divergentes (${s} vs ${c}); requiere decisión humana` };
}

export function gitIsAncestor(a, b) {
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", a, b], { stdio: "ignore" });
    return true;
  } catch (err) {
    if (err && err.status === 1) return false;
    throw new Error(`git merge-base falló para ${a} ${b}: ${err?.message ?? err}`);
  }
}

function arg(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const candidate = arg("candidate");
  const served = arg("served");
  if (!candidate || served === undefined) {
    console.error("uso: --candidate=<sha> --served=<sha|unknown>");
    process.exit(2);
  }
  let result;
  try {
    result = decideRelease({ candidate, served, isAncestor: gitIsAncestor });
  } catch (err) {
    result = { action: "blocked", reason: String(err?.message ?? err) };
  }
  process.stdout.write(JSON.stringify(result) + "\n");
  process.exit(result.action === "blocked" ? 3 : 0);
}
