import { Injectable, Logger } from "@nestjs/common";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, readdir, realpath, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { isPathInside, parseAllowedCommand, resolveWithinRoot } from "./technical-runtime.guards.js";

const execFileAsync = promisify(execFile);

@Injectable()
export class TechnicalRuntimeService {
  private readonly logger = new Logger(TechnicalRuntimeService.name);
  private readonly rootPath = resolve(process.cwd()); // Base path for security

  /** Env mínimo para los hijos: sin DATABASE_URL, llaves de API ni tokens del proceso. */
  private childEnv(): NodeJS.ProcessEnv {
    const keep = ["PATH", "HOME", "USERPROFILE", "TMPDIR", "TEMP", "TMP", "SystemRoot", "LANG"];
    return Object.fromEntries(keep.filter((k) => process.env[k] !== undefined).map((k) => [k, process.env[k]]));
  }

  /**
   * Hallazgo 0.38: la ruta debe quedar dentro de la raíz (por `relative`, no por prefijo de texto), no puede tocar
   * secretos (.env, llaves, .git) y, tras resolver enlaces simbólicos del ancestro existente más cercano, sigue dentro.
   */
  private async assertSafePath(path: string): Promise<string> {
    const resolvedPath = resolveWithinRoot(this.rootPath, path);
    const realRoot = await realpath(this.rootPath);
    let probe = resolvedPath;
    for (;;) {
      try {
        const real = await realpath(probe);
        if (!isPathInside(realRoot, real)) {
          throw new Error(`Acceso denegado: La ruta '${path}' resuelve fuera del workspace permitido.`);
        }
        break;
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
        const parent = dirname(probe);
        if (parent === probe) break;
        probe = parent;
      }
    }
    return resolvedPath;
  }

  async readTextFile(path: string): Promise<string> {
    const safePath = await this.assertSafePath(path);
    try {
      const content = await readFile(safePath, "utf8");
      return content;
    } catch (err) {
      throw new Error(`Error al leer archivo '${path}': ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async writeTextFile(path: string, content: string): Promise<void> {
    const safePath = await this.assertSafePath(path);
    try {
      await writeFile(safePath, content, "utf8");
    } catch (err) {
      throw new Error(`Error al escribir en archivo '${path}': ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async listDirectory(path: string): Promise<Array<{ name: string; isDir: boolean; size?: number }>> {
    const safePath = await this.assertSafePath(path);
    try {
      const entries = await readdir(safePath, { withFileTypes: true });
      const results = await Promise.all(
        entries.map(async (entry) => {
          const entryPath = join(safePath, entry.name);
          let size: number | undefined;
          if (entry.isFile()) {
            try {
              const s = await stat(entryPath);
              size = s.size;
            } catch {
              // ignore
            }
          }
          return {
            name: entry.name,
            isDir: entry.isDirectory(),
            size,
          };
        }),
      );
      return results;
    } catch (err) {
      throw new Error(`Error al listar directorio '${path}': ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async searchPatterns(query: string, path?: string): Promise<string[]> {
    const safePath = await this.assertSafePath(path ?? ".");
    try {
      // Usamos grep para buscar patrones de forma eficiente (sin shell, args directos)
      const { stdout } = await execFileAsync("grep", ["-rIl", "--exclude=.env*", "--exclude=*.pem", "--exclude=*.key", "--exclude-dir=.git", "--exclude-dir=node_modules", "--", query, safePath], { maxBuffer: 10 * 1024 * 1024, env: this.childEnv() });
      return stdout.trim().split("\n").filter(Boolean).slice(0, 50).map(p => p.replace(this.rootPath + "/", ""));
    } catch (err) {
      this.logger.warn(`Search failed or no matches found: ${String(err)}`);
      return [];
    }
  }

  async runCommand(command: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    // Hallazgo 0.38: sin shell. El comando se parsea a argv con una lista cerrada y las rutas se validan.
    const parsed = parseAllowedCommand(command);
    const safePathArgs = new Map<string, string>();
    for (const arg of parsed.pathArgs) safePathArgs.set(arg, await this.assertSafePath(arg));
    const args = parsed.args.map((arg) => safePathArgs.get(arg) ?? arg);

    try {
      const { stdout, stderr } = await execFileAsync(parsed.file, args, {
        cwd: this.rootPath,
        timeout: 30000,
        maxBuffer: 10 * 1024 * 1024,
        env: this.childEnv(),
      });
      return { stdout, stderr, exitCode: 0 };
    } catch (err: any) {
      return {
        stdout: err.stdout ?? "",
        stderr: err.stderr ?? err.message,
        exitCode: typeof err.code === "number" ? err.code : 1,
      };
    }
  }
}
