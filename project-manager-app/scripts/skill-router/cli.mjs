#!/usr/bin/env node
// SEMSE Skill Router CLI — Phase 1, report-only / shadow mode.
//
// Usage:
//   node scripts/skill-router/cli.mjs --report
//     -> discovery report only (skill count, metadata coverage, warnings)
//   node scripts/skill-router/cli.mjs "<task description>"
//     -> routing recommendation for that task (never enforced, never blocks)
//
// Options:
//   --roots a,b   comma-separated skill roots (default: .claude/skills)
//   --json        emit machine-readable JSON instead of the text report

import { discoverSkills } from "./lib/discover.mjs";
import { buildRegistry } from "./lib/registry.mjs";
import { route } from "./lib/router.mjs";
import { buildDiscoveryReport, renderDiscoveryReport, renderRouteDecision } from "./lib/report.mjs";

const DEFAULT_ROOTS = [".claude/skills"];

function parseArgs(argv) {
  const args = { roots: DEFAULT_ROOTS, json: false, report: false, task: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--roots") {
      args.roots = argv[++i]?.split(",").map((s) => s.trim()).filter(Boolean) ?? DEFAULT_ROOTS;
    } else if (arg === "--json") {
      args.json = true;
    } else if (arg === "--report") {
      args.report = true;
    } else {
      args.task.push(arg);
    }
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const discovery = discoverSkills(args.roots);
  const registry = buildRegistry(discovery);

  if (args.report || args.task.length === 0) {
    const report = buildDiscoveryReport(registry, { roots: args.roots });
    process.stdout.write((args.json ? JSON.stringify(report, null, 2) : renderDiscoveryReport(report)) + "\n");
    return;
  }

  const taskText = args.task.join(" ");
  const decision = route(taskText, registry);
  process.stdout.write((args.json ? JSON.stringify(decision, null, 2) : renderRouteDecision(decision)) + "\n");
}

main();
