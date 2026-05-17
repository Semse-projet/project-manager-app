import { spawnSync } from "node:child_process";

export function runGit(repoPath: string, args: string[]): string {
  const result = spawnSync("git", args, {
    cwd: repoPath,
    encoding: "utf8",
    env: { ...process.env, LANG: "C", LC_ALL: "C" }
  });

  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr || result.stdout}`);
  }

  return result.stdout.trim();
}

export function detectBaseBranch(repoPath: string, preferred = "main"): string {
  try {
    runGit(repoPath, ["rev-parse", "--verify", preferred]);
    return preferred;
  } catch {
    return "master";
  }
}

export function ensureCleanRepo(repoPath: string): void {
  const status = runGit(repoPath, ["status", "--porcelain"]);
  if (status) {
    throw new Error(`Repository is not clean:\n${status}`);
  }
}

export function currentBranch(repoPath: string): string {
  return runGit(repoPath, ["rev-parse", "--abbrev-ref", "HEAD"]);
}
