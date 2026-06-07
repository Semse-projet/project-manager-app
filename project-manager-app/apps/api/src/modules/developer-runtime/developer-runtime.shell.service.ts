import { exec } from "node:child_process";
import { promisify } from "node:util";
import { Injectable } from "@nestjs/common";
import type {
  DeveloperRuntimeRunCommandInput,
  DeveloperRuntimeRunCommandResult,
  DeveloperRuntimeToolName,
} from "@semse/schemas";

const execAsync = promisify(exec);

@Injectable()
export class DeveloperRuntimeShellService {
  getSupportedTools(): readonly DeveloperRuntimeToolName[] {
    return [
      "runCommand",
      "readFile",
      "writeFile",
      "patchFile",
      "listFiles",
      "searchCode",
      "runBuild",
      "runLint",
      "runTests",
      "gitStatus",
      "gitDiff",
      "installDependencies",
      "inspectEnv",
      "requestApproval",
    ];
  }

  async runCommand(input: DeveloperRuntimeRunCommandInput): Promise<DeveloperRuntimeRunCommandResult> {
    const startedAt = Date.now();
    const result = await execAsync(input.command, {
      cwd: input.cwd,
      env: input.env ? { ...process.env, ...input.env } : process.env,
      timeout: input.timeoutMs ?? 30_000,
      maxBuffer: 1024 * 1024,
      shell: "/bin/bash",
    });

    return {
      exitCode: 0,
      stdout: result.stdout,
      stderr: result.stderr,
      durationMs: Date.now() - startedAt,
    };
  }
}
