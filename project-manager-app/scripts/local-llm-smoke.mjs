const baseUrl = (process.env.SEMSE_LOCAL_LLM_BASE_URL?.trim() || "http://127.0.0.1:11434").replace(/\/$/, "");
const model = process.env.SEMSE_LOCAL_LLM_MODEL?.trim() || "qwen2.5:3b";
const apiKey = process.env.SEMSE_LOCAL_LLM_API_KEY?.trim();

function buildHeaders() {
  const headers = {
    "content-type": "application/json"
  };

  if (apiKey) {
    headers.authorization = `Bearer ${apiKey}`;
  }

  return headers;
}

async function main() {
  const tagsResponse = await fetch(`${baseUrl}/api/tags`);
  if (!tagsResponse.ok) {
    throw new Error(`Local LLM tags check failed: ${tagsResponse.status} ${await tagsResponse.text()}`);
  }

  const tagsPayload = await tagsResponse.json();
  const availableModels = Array.isArray(tagsPayload.models) ? tagsPayload.models.map((entry) => entry.name) : [];

  if (!availableModels.includes(model)) {
    throw new Error(`Model '${model}' is not pulled. Available: ${availableModels.join(", ") || "none"}`);
  }

  const chatResponse = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [
        { role: "system", content: "Respond with one short line only." },
        { role: "user", content: "Say 'semse local llm ready'." }
      ]
    })
  });

  if (!chatResponse.ok) {
    throw new Error(`Local LLM chat check failed: ${chatResponse.status} ${await chatResponse.text()}`);
  }

  const payload = await chatResponse.json();
  const content = payload?.choices?.[0]?.message?.content;

  process.stdout.write(
    `${JSON.stringify(
      {
        status: "ok",
        provider: "ollama",
        baseUrl,
        model,
        reply: typeof content === "string" ? content.trim() : null
      },
      null,
      2
    )}\n`
  );
}

main().catch((error) => {
  process.stderr.write(
    `${JSON.stringify(
      {
        status: "error",
        message: error instanceof Error ? error.message : String(error)
      },
      null,
      2
    )}\n`
  );
  process.exit(1);
});
