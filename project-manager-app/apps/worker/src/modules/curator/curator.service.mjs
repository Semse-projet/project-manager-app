/**
 * Curator Service — SEMSE OS
 *
 * Adapted from Hermes Agent curator.py
 * Runs weekly (or on-demand) to consolidate the Prometeo skill library.
 *
 * What it does:
 * 1. Scans apps/api/skills/ for SKILL.md files
 * 2. Applies automatic state transitions (stale/archive by age)
 * 3. Runs an LLM review pass to consolidate skills into umbrellas
 * 4. Writes a REPORT.md with findings
 * 5. Updates .curator_state.json for scheduling
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Anthropic from "@anthropic-ai/sdk";
import { CURATOR_REVIEW_PROMPT, CURATOR_DRY_RUN_BANNER } from "./curator.prompt.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SKILLS_DIR = path.resolve(__dirname, "../../../../api/skills");
const REPORTS_DIR = path.resolve(__dirname, "../../../../api/skills/.curator-reports");
const STATE_FILE = path.resolve(__dirname, "../../../../api/skills/.curator_state.json");
const ARCHIVE_DIR = path.resolve(SKILLS_DIR, ".archive");

const STALE_AFTER_DAYS = 60;
const ARCHIVE_AFTER_DAYS = 180;
const INTERVAL_DAYS = 7;
const MODEL = "claude-sonnet-4-6";

// ── State management ─────────────────────────────────────────────────────────

function loadState() {
  const defaults = {
    last_run_at: null,
    last_run_summary: null,
    last_report_path: null,
    run_count: 0,
    paused: false,
  };
  try {
    if (!fs.existsSync(STATE_FILE)) return defaults;
    return { ...defaults, ...JSON.parse(fs.readFileSync(STATE_FILE, "utf-8")) };
  } catch {
    return defaults;
  }
}

function saveState(data) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

function shouldRunNow() {
  const state = loadState();
  if (state.paused) return false;
  if (!state.last_run_at) {
    // Seed — defer first run
    const s = loadState();
    s.last_run_at = new Date().toISOString();
    s.last_run_summary = "deferred first run — seeded";
    saveState(s);
    return false;
  }
  const lastRun = new Date(state.last_run_at).getTime();
  const now = Date.now();
  return (now - lastRun) >= INTERVAL_DAYS * 24 * 3600 * 1000;
}

// ── Skill scanning ────────────────────────────────────────────────────────────

function scanSkills() {
  if (!fs.existsSync(SKILLS_DIR)) return [];

  const skills = [];
  const entries = fs.readdirSync(SKILLS_DIR, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith(".")) continue;

    const skillFile = path.join(SKILLS_DIR, entry.name, "SKILL.md");
    if (!fs.existsSync(skillFile)) continue;

    try {
      const raw = fs.readFileSync(skillFile, "utf-8");
      const stat = fs.statSync(skillFile);
      const frontmatter = parseFrontmatter(raw);
      skills.push({
        name: entry.name,
        description: frontmatter.description ?? "",
        tags: frontmatter.metadata?.semse?.tags ?? [],
        intents: frontmatter.metadata?.semse?.intents ?? [],
        filePath: skillFile,
        mtime: stat.mtime,
        state: "active",
      });
    } catch {
      // skip
    }
  }
  return skills;
}

function parseFrontmatter(content) {
  if (!content.startsWith("---")) return {};
  const endIdx = content.indexOf("\n---", 3);
  if (endIdx === -1) return {};
  const yaml = content.slice(3, endIdx);
  // Extract description at minimum
  const desc = yaml.match(/^description:\s*["']?(.+?)["']?\s*$/m)?.[1] ?? "";
  const tags = yaml.match(/tags:\s*\[([^\]]+)\]/)?.[1]?.split(",").map((t) => t.trim().replace(/['"]/g, "")) ?? [];
  const intents = yaml.match(/intents:\s*\[([^\]]+)\]/)?.[1]?.split(",").map((t) => t.trim().replace(/['"]/g, "")) ?? [];
  return { description: desc, metadata: { semse: { tags, intents } } };
}

// ── Auto transitions (no LLM) ─────────────────────────────────────────────────

function applyAutoTransitions(skills) {
  const now = Date.now();
  const counts = { checked: skills.length, marked_stale: 0, archived: 0 };

  for (const skill of skills) {
    const ageMs = now - new Date(skill.mtime).getTime();
    const ageDays = ageMs / (1000 * 3600 * 24);

    if (ageDays > ARCHIVE_AFTER_DAYS && skill.state === "active") {
      skill.state = "stale";
      counts.marked_stale++;
    } else if (ageDays > STALE_AFTER_DAYS && skill.state === "active") {
      skill.state = "stale";
      counts.marked_stale++;
    }
  }
  return counts;
}

// ── Candidate list render ─────────────────────────────────────────────────────

function renderCandidateList(skills) {
  if (!skills.length) return "No hay skills para revisar.";
  const lines = [`Skills disponibles (${skills.length}):\n`];
  for (const s of skills) {
    lines.push(
      `- ${s.name}  state=${s.state}  intents=[${s.intents.join(",")}]  tags=[${s.tags.join(",")}]`,
      `  desc: ${s.description}`,
    );
  }
  return lines.join("\n");
}

// ── LLM review pass ───────────────────────────────────────────────────────────

async function runLlmReview(candidateList, dryRun = false) {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const prompt = dryRun
    ? `${CURATOR_DRY_RUN_BANNER}\n\n${CURATOR_REVIEW_PROMPT}\n\n${candidateList}`
    : `${CURATOR_REVIEW_PROMPT}\n\n${candidateList}`;

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const final = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    return {
      final,
      summary: final.slice(0, 240),
      error: null,
    };
  } catch (err) {
    return {
      final: "",
      summary: `error: ${err.message}`,
      error: err.message,
    };
  }
}

// ── Report writing ────────────────────────────────────────────────────────────

function writeReport({ startedAt, durationSeconds, autoTransitions, skillsBefore, skillsAfter, llmResult, dryRun }) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });

  const stamp = startedAt.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const runDir = path.join(REPORTS_DIR, stamp);
  fs.mkdirSync(runDir, { recursive: true });

  const removed = skillsBefore.filter((s) => !skillsAfter.find((a) => a.name === s.name)).map((s) => s.name);
  const added = skillsAfter.filter((s) => !skillsBefore.find((b) => b.name === s.name)).map((s) => s.name);

  const payload = {
    started_at: startedAt.toISOString(),
    duration_seconds: Math.round(durationSeconds),
    dry_run: dryRun,
    auto_transitions: autoTransitions,
    counts: {
      before: skillsBefore.length,
      after: skillsAfter.length,
      delta: skillsAfter.length - skillsBefore.length,
      archived_this_run: removed.length,
      added_this_run: added.length,
    },
    removed,
    added,
    llm_summary: llmResult.summary,
    llm_error: llmResult.error,
    llm_final: llmResult.final,
  };

  fs.writeFileSync(path.join(runDir, "run.json"), JSON.stringify(payload, null, 2) + "\n");

  const md = [
    `# Curator run — ${startedAt.toISOString()}`,
    `Model: \`${MODEL}\`  Duration: ${Math.round(durationSeconds)}s  ${dryRun ? "(DRY RUN)" : ""}`,
    "",
    "## Auto-transitions",
    `- checked: ${autoTransitions.checked}`,
    `- marked stale: ${autoTransitions.marked_stale}`,
    `- archived: ${autoTransitions.archived}`,
    "",
    `## Skills: ${skillsBefore.length} → ${skillsAfter.length}`,
    removed.length ? `### Removed\n${removed.map((n) => `- \`${n}\``).join("\n")}` : "",
    added.length ? `### Added\n${added.map((n) => `- \`${n}\``).join("\n")}` : "",
    "",
    "## LLM Summary",
    llmResult.error ? `> ERROR: ${llmResult.error}` : llmResult.final,
    "",
    "## Recovery",
    "Archived skills live in `skills/.archive/` — restore with `mv .archive/<name> <skills_dir>/<name>`",
  ].filter((l) => l !== null).join("\n");

  fs.writeFileSync(path.join(runDir, "REPORT.md"), md);
  return runDir;
}

// ── Main orchestrator ─────────────────────────────────────────────────────────

export async function runCurator({ force = false, dryRun = false, onProgress } = {}) {
  const log = (msg) => {
    console.log(`[curator] ${msg}`);
    onProgress?.(msg);
  };

  if (!force && !shouldRunNow()) {
    log("skipped — interval not reached or paused");
    return { skipped: true };
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    log("skipped — ANTHROPIC_API_KEY not set");
    return { skipped: true, reason: "no api key" };
  }

  const startedAt = new Date();
  log(`starting ${dryRun ? "(dry-run)" : ""}`);

  const skillsBefore = scanSkills();
  const autoTransitions = applyAutoTransitions(skillsBefore);
  log(`auto-transitions: ${autoTransitions.marked_stale} stale, ${autoTransitions.archived} archived`);

  const candidateList = renderCandidateList(skillsBefore);
  log("running LLM review...");

  const llmResult = await runLlmReview(candidateList, dryRun);
  log(`LLM done: ${llmResult.error ? "ERROR" : "ok"}`);

  const skillsAfter = scanSkills();
  const durationSeconds = (Date.now() - startedAt.getTime()) / 1000;

  const reportDir = writeReport({
    startedAt, durationSeconds, autoTransitions,
    skillsBefore, skillsAfter, llmResult, dryRun,
  });

  const state = loadState();
  if (!dryRun) {
    state.last_run_at = startedAt.toISOString();
    state.run_count = (state.run_count ?? 0) + 1;
  }
  state.last_run_summary = `${dryRun ? "dry-run: " : ""}${llmResult.summary}`;
  state.last_report_path = reportDir;
  saveState(state);

  log(`done — report: ${reportDir}`);
  return { skipped: false, reportDir, durationSeconds, autoTransitions };
}

// ── CLI entrypoint ────────────────────────────────────────────────────────────

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const force = args.includes("--force");

  runCurator({ force: force || true, dryRun, onProgress: console.log })
    .then((r) => {
      console.log("[curator] result:", JSON.stringify(r, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error("[curator] fatal:", err);
      process.exit(1);
    });
}
