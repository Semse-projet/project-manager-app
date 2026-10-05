import { isAbsolute, join, relative, resolve, sep } from "node:path";

/**
 * Hallazgo 0.38 — guards puros del TechnicalRuntimeService (sin I/O, testeables).
 *  - la ruta debe quedar DENTRO de la raíz (comparación por `relative`, no por prefijo de texto: `/app-evil` ya no pasa por `/app`);
 *  - nunca se tocan secretos ni internos de git;
 *  - los comandos no pasan por shell: se parsean a argv con una lista cerrada de comandos, banderas y forma.
 */

const SENSITIVE_SEGMENTS = new Set([".git", ".ssh", ".aws", ".gnupg"]);
const SENSITIVE_FILE = /^(\.env(\..*)?|.*\.(pem|key|p12|pfx|keystore)|id_(rsa|dsa|ecdsa|ed25519)|\.npmrc|\.netrc)$/i;

export function isPathInside(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

export function isSensitivePath(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return rel.split(sep).filter(Boolean).some((part) => SENSITIVE_SEGMENTS.has(part) || SENSITIVE_FILE.test(part));
}

export function resolveWithinRoot(root: string, path: string): string {
  const resolved = resolve(isAbsolute(path) ? path : join(root, path));
  if (!isPathInside(root, resolved)) {
    throw new Error(`Acceso denegado: La ruta '${path}' está fuera del workspace permitido.`);
  }
  if (isSensitivePath(root, resolved)) {
    throw new Error(`Acceso denegado: La ruta '${path}' contiene secretos o metadatos protegidos.`);
  }
  return resolved;
}

export type ParsedCommand = { file: string; args: string[]; pathArgs: string[] };

const SHELL_METACHARACTERS = /[;&|<>`$(){}[\]\\\n\r\t"'*?!~#=%^]/;
const SCRIPT_NAME = /^[a-z0-9][a-z0-9:_-]*$/i;
const FLAGS: Record<string, Set<string>> = {
  ls: new Set(["l", "a", "h", "1", "R"]),
  cat: new Set(["n"]),
  grep: new Set(["r", "n", "i", "l", "I", "c", "w", "F"]),
};

function assertFlag(command: string, token: string): void {
  const allowed = FLAGS[command]!;
  const letters = [...token.slice(1)];
  if (letters.length === 0 || !letters.every((letter) => allowed.has(letter))) {
    throw new Error(`Bandera no permitida para '${command}': '${token}'.`);
  }
}

/**
 * Convierte un comando en argv. Acepta solo: `npm test`, `npm build`, `npm run <script>`, `ls|cat|grep` con banderas
 * de una lista cerrada y rutas, y `echo` de texto simple. Cualquier metacaracter de shell, bandera desconocida o
 * argumento extra se rechaza. `pathArgs` son los argumentos que el llamador debe validar como rutas.
 */
export function parseAllowedCommand(command: string): ParsedCommand {
  const reject = (): never => {
    throw new Error(`Comando no permitido: '${command}'. Solo se permiten comandos de inspección, build o test.`);
  };
  if (typeof command !== "string" || command.length > 500 || SHELL_METACHARACTERS.test(command)) return reject();
  const tokens = command.trim().split(/ +/).filter(Boolean);
  const [head, ...rest] = tokens;

  switch (head) {
    case "npm": {
      if (rest.length === 1 && (rest[0] === "test" || rest[0] === "build")) return { file: "npm", args: [...rest], pathArgs: [] };
      if (rest.length === 2 && rest[0] === "run" && SCRIPT_NAME.test(rest[1]!)) return { file: "npm", args: [...rest], pathArgs: [] };
      return reject();
    }
    case "echo":
      return rest.length > 0 && rest.every((token) => !token.startsWith("-")) ? { file: "echo", args: rest, pathArgs: [] } : reject();
    case "ls":
    case "cat":
    case "grep": {
      const flags: string[] = [];
      const positional: string[] = [];
      for (const token of rest) {
        if (token.startsWith("-")) {
          if (positional.length > 0) return reject();
          assertFlag(head, token);
          flags.push(token);
        } else {
          positional.push(token);
        }
      }
      if (head === "ls") return { file: "ls", args: [...flags, ...positional], pathArgs: positional };
      if (head === "cat") return positional.length > 0 ? { file: "cat", args: [...flags, ...positional], pathArgs: positional } : reject();
      const [pattern, ...paths] = positional;
      if (!pattern || paths.length === 0) return reject();
      return { file: "grep", args: [...flags, "--", pattern, ...paths], pathArgs: paths };
    }
    default:
      return reject();
  }
}
