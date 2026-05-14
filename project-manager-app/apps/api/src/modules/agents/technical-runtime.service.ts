import { Injectable, Logger } from "@nestjs/common";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join, resolve, isAbsolute } from "node:path";

const execAsync = promisify(exec);

@Injectable()
export class TechnicalRuntimeService {
  private readonly logger = new Logger(TechnicalRuntimeService.name);
  private readonly rootPath = resolve(process.cwd()); // Base path for security

  private async assertSafePath(path: string): Promise<string> {
    const absolutePath = isAbsolute(path) ? path : join(this.rootPath, path);
    const resolvedPath = resolve(absolutePath);

    if (!resolvedPath.startsWith(this.rootPath)) {
      throw new Error(`Acceso denegado: La ruta '${path}' está fuera del workspace permitido.`);
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
      // Usamos grep para buscar patrones de forma eficiente
      const { stdout } = await execAsync(`grep -rIl "${query.replace(/"/g, '\\"')}" "${safePath}" | head -n 50`);
      return stdout.trim().split("\n").filter(Boolean).map(p => p.replace(this.rootPath + "/", ""));
    } catch (err) {
      this.logger.warn(`Search failed or no matches found: ${String(err)}`);
      return [];
    }
  }

  async runCommand(command: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    // Lista de comandos permitidos ( whitelist )
    const allowedPrefixes = ["pnpm build", "pnpm test", "pnpm typecheck", "pnpm lint", "pnpm smoke:", "pnpm verify:", "ls ", "grep ", "cat ", "echo "];
    const isAllowed = allowedPrefixes.some(prefix => command.startsWith(prefix));

    if (!isAllowed) {
      throw new Error(`Comando no permitido: '${command}'. Solo se permiten comandos de inspección, build o test.`);
    }

    try {
      const { stdout, stderr } = await execAsync(command, { cwd: this.rootPath, timeout: 30000 });
      return { stdout, stderr, exitCode: 0 };
    } catch (err: any) {
      return {
        stdout: err.stdout ?? "",
        stderr: err.stderr ?? err.message,
        exitCode: err.code ?? 1,
      };
    }
  }
}
