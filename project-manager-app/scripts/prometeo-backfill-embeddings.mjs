#!/usr/bin/env node
/**
 * Prometeo Embeddings Backfill
 * Finds DocumentChunks with zero/null embeddings and re-generates them.
 *
 * Usage:
 *   node scripts/prometeo-backfill-embeddings.mjs
 *   node scripts/prometeo-backfill-embeddings.mjs --dry-run
 *   node scripts/prometeo-backfill-embeddings.mjs --tenant <tenantId>
 *   node scripts/prometeo-backfill-embeddings.mjs --batch-size 16
 */

import { PrismaClient } from "@prisma/client";

const OPENAI_KEY       = process.env.OPENAI_API_KEY;
const MODEL            = process.env.EMBEDDINGS_MODEL ?? "text-embedding-3-small";
const DIM              = parseInt(process.env.EMBEDDINGS_DIMENSIONS ?? "1536", 10);
const BATCH_SIZE       = parseInt(process.argv.find((a, i) => process.argv[i-1] === "--batch-size") ?? "16", 10);
const DRY_RUN          = process.argv.includes("--dry-run");
const TENANT_FILTER    = process.argv[process.argv.indexOf("--tenant") + 1];
const TIMEOUT_MS       = parseInt(process.env.EMBEDDINGS_TIMEOUT_MS ?? "30000", 10);

function isZeroVector(vec) {
  return !vec || !Array.isArray(vec) || vec.length === 0 || vec.every((v) => v === 0);
}

async function embedBatch(texts) {
  if (!OPENAI_KEY) throw new Error("OPENAI_API_KEY not set — cannot generate real embeddings");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const resp = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${OPENAI_KEY}` },
    body: JSON.stringify({ model: MODEL, input: texts.map((t) => t.slice(0, 8000)) }),
    signal: controller.signal,
  }).finally(() => clearTimeout(timer));

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`OpenAI HTTP ${resp.status}: ${err.slice(0, 200)}`);
  }

  const json = await resp.json();
  return json.data.map((d) => d.embedding);
}

async function main() {
  console.log("\n=== Prometeo Embeddings Backfill ===");
  console.log(`Model:      ${MODEL}`);
  console.log(`Batch size: ${BATCH_SIZE}`);
  console.log(`Dry run:    ${DRY_RUN}`);
  console.log(`API key:    ${OPENAI_KEY ? "✅ set" : "❌ NOT SET"}`);
  if (TENANT_FILTER) console.log(`Tenant:     ${TENANT_FILTER}`);
  console.log("");

  if (!OPENAI_KEY && !DRY_RUN) {
    console.error("❌ OPENAI_API_KEY is required for backfill. Set it or use --dry-run.");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const started = Date.now();

  try {
    // 1. Find all indexed documents
    const docs = await prisma.prometeoDocument.findMany({
      where: {
        status: "indexed",
        ...(TENANT_FILTER ? { tenantId: TENANT_FILTER } : {}),
      },
      select: { id: true, tenantId: true, title: true },
    });

    console.log(`📚 Found ${docs.length} indexed documents`);

    if (!docs.length) {
      console.log("No documents to process.");
      await prisma.$disconnect();
      return;
    }

    // 2. Load all chunks for these docs
    const docIds = docs.map((d) => d.id);
    const allChunks = await prisma.documentChunk.findMany({
      where: { documentId: { in: docIds } },
      select: { id: true, documentId: true, chunkIndex: true, text: true, embeddingJson: true },
    });

    console.log(`📦 Total chunks: ${allChunks.length}`);

    // 3. Find chunks missing real embeddings
    const needsEmbedding = allChunks.filter((c) => isZeroVector(c.embeddingJson));
    const alreadyEmbedded = allChunks.length - needsEmbedding.length;

    console.log(`✅ Already embedded: ${alreadyEmbedded}`);
    console.log(`⚠️  Missing embeddings: ${needsEmbedding.length}`);

    if (!needsEmbedding.length) {
      console.log("\n✨ All chunks already have real embeddings!");
      await prisma.$disconnect();
      return;
    }

    if (DRY_RUN) {
      console.log("\n🔍 Dry run — no changes made.");
      console.log(`Would embed ${needsEmbedding.length} chunks in ${Math.ceil(needsEmbedding.length / BATCH_SIZE)} batches.`);
      await prisma.$disconnect();
      return;
    }

    // 4. Process in batches
    let embedded = 0;
    let failed = 0;

    for (let i = 0; i < needsEmbedding.length; i += BATCH_SIZE) {
      const batch = needsEmbedding.slice(i, i + BATCH_SIZE);
      const texts = batch.map((c) => c.text);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(needsEmbedding.length / BATCH_SIZE);

      process.stdout.write(`  Batch ${batchNum}/${totalBatches} (${batch.length} chunks)... `);

      try {
        const embeddings = await embedBatch(texts);

        // Update each chunk
        await Promise.all(batch.map((chunk, idx) =>
          prisma.documentChunk.update({
            where: { id: chunk.id },
            data: { embeddingJson: embeddings[idx] },
          })
        ));

        embedded += batch.length;
        console.log(`✅ done`);
      } catch (err) {
        failed += batch.length;
        console.log(`❌ failed: ${err.message}`);

        // On rate limit, wait before continuing
        if (err.message.includes("429")) {
          console.log("  Rate limited — waiting 60s...");
          await new Promise((r) => setTimeout(r, 60_000));
        }
      }

      // Small delay between batches to avoid rate limits
      if (i + BATCH_SIZE < needsEmbedding.length) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    const duration = ((Date.now() - started) / 1000).toFixed(1);
    console.log("\n=== Backfill Complete ===");
    console.log(`✅ Embedded:  ${embedded}`);
    console.log(`❌ Failed:    ${failed}`);
    console.log(`⏱️  Duration:  ${duration}s`);
    console.log(`📐 Model:     ${MODEL} (${DIM}d)`);

    if (failed > 0) {
      console.log("\n⚠️  Some chunks failed. Re-run to retry.");
      process.exit(1);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
