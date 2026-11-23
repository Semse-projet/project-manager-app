import test from "node:test";
import assert from "node:assert/strict";
import { HttpUrlStorageReader } from "../dist/modules/agro/agro-asr.js";

test("HttpUrlStorageReader.readBuffer stays fail-closed and never fetches", async () => {
  let fetched = 0;
  const original = globalThis.fetch;
  globalThis.fetch = (async () => {
    fetched += 1;
    return new Response("should-not-run");
  }) as typeof fetch;
  try {
    const reader = new HttpUrlStorageReader();
    await assert.rejects(() => reader.readBuffer("https://8.8.8.8/audio.m4a"), /AUDIO_SOURCE_NOT_VERIFIED/);
    assert.equal(fetched, 0);
  } finally {
    globalThis.fetch = original;
  }
});

test("HttpUrlStorageReader.readAllowlistedBuffer fetches only after allowlist and redirect checks", async () => {
  const reader = new HttpUrlStorageReader();
  const fetchImpl = async (url: string) => {
    if (url === "https://8.8.8.8/go") {
      return new Response(null, { status: 302, headers: { Location: "https://127.0.0.1/x" } });
    }
    if (url === "https://8.8.8.8/ok") {
      return new Response(Buffer.from("audio-bytes"));
    }
    throw new Error(`unexpected ${url}`);
  };

  await assert.rejects(
    () => reader.readAllowlistedBuffer("https://8.8.8.8/go", ["8.8.8.8"], fetchImpl as typeof fetch),
    /unsafe_resolved_address|loopback/,
  );

  const buf = await reader.readAllowlistedBuffer("https://8.8.8.8/ok", ["8.8.8.8"], fetchImpl as typeof fetch);
  assert.equal(buf.toString(), "audio-bytes");
});
