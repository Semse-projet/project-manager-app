import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

export function sanitizeBranchName(task: string): string {
  const slug = task
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "")
    .slice(0, 48);
  return `feat/${slug || "autonomous-change"}`;
}

export function assertRepoPath(repoPath: string): void {
  if (!existsSync(repoPath)) {
    throw new Error(`Repo path does not exist: ${repoPath}`);
  }

  const result = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], {
    cwd: repoPath,
    encoding: "utf8"
  });

  if (result.status !== 0 || result.stdout.trim() !== "true") {
    throw new Error(`Not a git repository: ${repoPath}`);
  }
}

