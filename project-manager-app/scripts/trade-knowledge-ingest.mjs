#!/usr/bin/env node
/**
 * Trade Knowledge Library — Ingestion Script
 *
 * Uploads all trade knowledge documents to Prometeo RAG.
 * Polls for indexing status and verifies real embeddings (not zero-vectors).
 *
 * Usage:
 *   node scripts/trade-knowledge-ingest.mjs
 *   API_URL=https://... JWT=eyJ... node scripts/trade-knowledge-ingest.mjs
 *   node scripts/trade-knowledge-ingest.mjs --dry-run
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = join(__dir, "trade-knowledge");

const API_URL = process.env.API_URL ?? "https://project-manager-app-production-012e.up.railway.app";
const JWT     = process.env.JWT ?? "";
const DRY_RUN = process.argv.includes("--dry-run");

// Trade mapping: filename → trade slug
const TRADE_MAP = {
  "electrical.md":      "electrical",
  "plumbing.md":        "plumbing",
  "drywall.md":         "drywall",
  "painting.md":        "painting",
  "hvac.md":            "hvac",
  "carpentry.md":       "carpentry",
  "general-safety.md":  "general",
  "bathroom-remodel.md":"bathroom",
  "kitchen-remodel.md": "kitchen",
  "windows-doors.md":   "windows_doors",
  "siding-exterior.md": "siding",
  "demolition.md":      "demolition",
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function log(msg)  { console.log(`[${new Date().toISOString().slice(11,19)}] ${msg}`); }
function warn(msg) { console.warn(`[${new Date().toISOString().slice(11,19)}] ⚠️  ${msg}`); }
function ok(msg)   { console.log(`[${new Date().toISOString().slice(11,19)}] ✅ ${msg}`); }
function fail(msg) { console.error(`[${new Date().toISOString().slice(11,19)}] ❌ ${msg}`); }

async function apiFetch(path, options = {}) {
  const url = `${API_URL}${path}`;
  const headers = {
    "Content-Type": "application/json",
    ...(JWT ? { Authorization: `Bearer ${JWT}` } : {}),
    ...options.headers,
  };
  const res = await fetch(url, { ...options, headers });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: res.status, json };
}

async function getJwt(bootstrapToken) {
  log("Obtaining JWT from bootstrap token...");
  const { status, json } = await apiFetch("/v1/auth/token", {
    method: "POST",
    headers: { "x-semse-bootstrap-token": bootstrapToken },
    body: JSON.stringify({
      userId: "system-trade-ingest",
      tenantId: "tenant_default",
      orgId: "org_default",
      roles: ["admin"],
    }),
  });
  if (status !== 200 && status !== 201) {
    throw new Error(`Bootstrap failed (${status}): ${JSON.stringify(json)}`);
  }
  const token = json?.data?.token ?? json?.token;
  if (!token) throw new Error(`No token in response: ${JSON.stringify(json)}`);
  log(`JWT obtained (len=${token.length})`);
  return token;
}

async function ingestDocument(jwt, { title, text, trade }) {
  const { status, json } = await apiFetch("/v1/prometeo/ingest", {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ title, text, trade, visibility: "public_training" }),
  });
  if (status !== 200 && status !== 201) {
    throw new Error(`Ingest failed (${status}): ${JSON.stringify(json).slice(0, 200)}`);
  }
  return json?.data ?? json;
}

async function pollDocumentStatus(jwt, docId, maxWaitMs = 120_000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    await new Promise(r => setTimeout(r, 3000));
    const { status, json } = await apiFetch(`/v1/prometeo/documents?limit=50`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    if (status !== 200) continue;
    const docs = json?.data?.documents ?? json?.data ?? [];
    const doc = Array.isArray(docs) ? docs.find(d => d.id === docId) : null;
    if (!doc) continue;
    if (doc.status === "indexed") return { status: "indexed", chunkCount: doc.chunkCount };
    if (doc.status === "failed")  return { status: "failed", error: doc.errorMsg };
    log(`  → ${doc.status} (${Math.round((Date.now() - start) / 1000)}s elapsed)...`);
  }
  return { status: "timeout" };
}

async function checkEmbeddingsHealth(jwt) {
  const { status, json } = await apiFetch("/v1/prometeo/embeddings/health", {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  if (status !== 200) return null;
  return json?.data ?? json;
}

async function testQuery(jwt, query, trade) {
  const { status, json } = await apiFetch("/v1/prometeo/search", {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ query, topK: 3, trade }),
  });
  if (status !== 200) return null;
  return json?.data ?? json;
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  log("═══════════════════════════════════════════════════════════");
  log("  SEMSE Trade Knowledge Library — Ingestion");
  log(`  API: ${API_URL}`);
  log(`  Mode: ${DRY_RUN ? "DRY RUN (no writes)" : "LIVE"}`);
  log("═══════════════════════════════════════════════════════════");

  // ── Step 0: Get JWT ────────────────────────────────────────────────────────
  let jwt = JWT;
  if (!jwt) {
    // Try reading from /tmp if set by parent process
    try {
      jwt = readFileSync("/tmp/semse_jwt", "utf8").trim();
      log(`Using JWT from /tmp/semse_jwt (len=${jwt.length})`);
    } catch {
      const bootstrapPath = "/tmp/semse_bootstrap_token";
      try {
        const bootstrap = readFileSync(bootstrapPath, "utf8").trim();
        jwt = await getJwt(bootstrap);
      } catch {
        fail("No JWT or bootstrap token available. Set JWT env var or put bootstrap token in /tmp/semse_bootstrap_token");
        process.exit(1);
      }
    }
  }

  // ── Step 1: Check embeddings health before ingestion ──────────────────────
  log("\n── Step 1: Checking embedding health before ingestion...");
  const healthBefore = await checkEmbeddingsHealth(jwt);
  if (healthBefore) {
    log(`  Provider:  ${healthBefore.embeddingsProvider ?? "unknown"}`);
    log(`  Available: ${healthBefore.embeddingsAvailable}`);
    log(`  Docs before: ${healthBefore.totalDocuments ?? "?"}`);
    if (!healthBefore.embeddingsAvailable) {
      warn("  OPENAI_API_KEY not set or unhealthy — will use FTS fallback mode");
    }
  } else {
    warn("  Could not reach embeddings/health endpoint — continuing anyway");
  }

  // ── Step 2: Load documents ─────────────────────────────────────────────────
  log("\n── Step 2: Loading trade documents...");
  const files = readdirSync(DOCS_DIR).filter(f => f.endsWith(".md"));
  const documents = files.map(file => {
    const text = readFileSync(join(DOCS_DIR, file), "utf8");
    const trade = TRADE_MAP[file] ?? "general";
    // Extract title from first heading
    const titleMatch = text.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : basename(file, ".md");
    return { file, title, text, trade };
  });

  log(`  Found ${documents.length} documents:`);
  for (const d of documents) {
    log(`    • ${d.file} → trade="${d.trade}", len=${d.text.length} chars`);
  }

  if (DRY_RUN) {
    log("\n  [DRY RUN] Skipping API calls.");
    log("  Documents that would be ingested:");
    for (const d of documents) {
      log(`    ✓ "${d.title}" (${d.trade})`);
    }
    return;
  }

  // ── Step 3: Ingest each document ──────────────────────────────────────────
  log("\n── Step 3: Ingesting documents into Prometeo...");
  const results = [];

  for (const doc of documents) {
    log(`\n  Ingesting: "${doc.title}" (trade=${doc.trade})`);
    try {
      const result = await ingestDocument(jwt, doc);
      log(`  → Created doc ID: ${result.id}, status: ${result.status}`);
      results.push({ ...doc, docId: result.id, ingestStatus: "submitted" });
    } catch (err) {
      fail(`  → Failed to ingest "${doc.title}": ${err.message}`);
      results.push({ ...doc, docId: null, ingestStatus: "error", error: err.message });
    }
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 500));
  }

  // ── Step 4: Poll for indexing completion ──────────────────────────────────
  log("\n── Step 4: Waiting for indexing to complete...");
  const indexResults = [];

  for (const r of results.filter(r => r.docId)) {
    log(`  Polling: "${r.title}" (${r.docId.slice(0, 12)}...)`);
    const result = await pollDocumentStatus(jwt, r.docId, 120_000);
    indexResults.push({ ...r, indexStatus: result.status, chunkCount: result.chunkCount, indexError: result.error });

    if (result.status === "indexed") {
      ok(`  → Indexed: ${result.chunkCount} chunks`);
    } else if (result.status === "failed") {
      fail(`  → Failed: ${result.error}`);
    } else {
      warn(`  → Timeout waiting for indexing`);
    }
  }

  // ── Step 5: Check embeddings health after ingestion ───────────────────────
  log("\n── Step 5: Checking embedding health after ingestion...");
  await new Promise(r => setTimeout(r, 2000)); // Let stats settle
  const healthAfter = await checkEmbeddingsHealth(jwt);
  let retrievalMode = "unknown";
  if (healthAfter) {
    retrievalMode = healthAfter.retrievalMode ?? "unknown";
    log(`  Provider:          ${healthAfter.embeddingsProvider}`);
    log(`  Model:             ${healthAfter.embeddingsModel}`);
    log(`  Available:         ${healthAfter.embeddingsAvailable}`);
    log(`  Healthy:           ${healthAfter.embeddingsHealthy}`);
    log(`  Total documents:   ${healthAfter.totalDocuments}`);
    log(`  Total chunks:      ${healthAfter.totalChunks}`);
    log(`  With embeddings:   ${healthAfter.chunksWithEmbeddings}`);
    log(`  Missing embeddings:${healthAfter.chunksMissingEmbeddings}`);
    log(`  Avg latency:       ${healthAfter.avgEmbeddingLatencyMs}ms`);
    log(`  Retrieval mode:    ${retrievalMode}`);
    if (healthAfter.lastEmbeddingError) {
      warn(`  Last error: ${healthAfter.lastEmbeddingError}`);
    }
  }

  // ── Step 6: Test semantic queries ─────────────────────────────────────────
  log("\n── Step 6: Testing semantic queries...");
  const testCases = [
    {
      query: "What should I check before closing a wall with electrical installation?",
      trade: undefined, // trade filter only works if chunks have trade metadata
    },
    {
      query: "How do I install a P-trap correctly and what slope does the drain need?",
      trade: undefined,
    },
    {
      query: "What type of drywall is required in a garage wall next to living space?",
      trade: undefined,
    },
  ];

  for (const tc of testCases) {
    log(`\n  Query: "${tc.query}"`);
    const results = await testQuery(jwt, tc.query, tc.trade);
    if (!results || !Array.isArray(results) || results.length === 0) {
      warn(`  → No results returned`);
      continue;
    }
    const top = results[0];
    log(`  → Top result (score=${top.score?.toFixed(3)})`);
    log(`     Document: "${top.documentTitle}"`);
    log(`     Mode:     ${top.retrievalMode}`);
    log(`     Text:     "${top.text?.slice(0, 120).replace(/\n/g, " ")}..."`);
    if (top.semanticScore !== undefined) {
      log(`     Semantic score: ${top.semanticScore.toFixed(3)} | FTS score: ${top.textScore?.toFixed(3)}`);
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  log("\n═══════════════════════════════════════════════════════════");
  log("  INGESTION SUMMARY");
  log("═══════════════════════════════════════════════════════════");

  const indexed  = indexResults.filter(r => r.indexStatus === "indexed");
  const failed   = indexResults.filter(r => r.indexStatus === "failed");
  const timedOut = indexResults.filter(r => r.indexStatus === "timeout");
  const totalChunks = indexed.reduce((s, r) => s + (r.chunkCount ?? 0), 0);

  log(`  Documents submitted: ${results.length}`);
  ok(`  Indexed:             ${indexed.length}`);
  if (failed.length)   fail(`  Failed:              ${failed.length}`);
  if (timedOut.length) warn(`  Timed out:           ${timedOut.length}`);
  log(`  Total chunks:        ${totalChunks}`);
  log(`  Retrieval mode:      ${retrievalMode}`);
  log("");

  for (const r of indexResults) {
    const icon = r.indexStatus === "indexed" ? "✅" : r.indexStatus === "failed" ? "❌" : "⏳";
    const detail = r.indexStatus === "indexed"
      ? `${r.chunkCount} chunks`
      : r.indexError ?? r.indexStatus;
    log(`  ${icon} [${r.trade.padEnd(12)}] "${r.title}" — ${detail}`);
  }

  log("");
  if (retrievalMode === "hybrid") {
    ok("Retrieval mode: HYBRID ✓ — OpenAI embeddings are active and working.");
  } else if (retrievalMode === "fts_fallback") {
    warn("Retrieval mode: FTS FALLBACK — embeddings not active. Check OPENAI_API_KEY in Railway.");
    warn("Run backfill after fixing: node scripts/prometeo-backfill-embeddings.mjs");
  }
  log("═══════════════════════════════════════════════════════════");
}

main().catch(err => {
  fail(`Fatal error: ${err.message}`);
  console.error(err);
  process.exit(1);
});
