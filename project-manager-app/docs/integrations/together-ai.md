# Together AI — SEMSE LLMOrchestrator (opt-in)

**State:** Code proposed in a draft PR; not activated or verified in production.

## Scope

This adapter uses Together AI's OpenAI-compatible Chat Completions API through the existing `openai` npm SDK. It plugs into `LLMOrchestrator` and its provider metrics. It does **not** replace Ollama, unify the separate AiModelGateway route, enable model tool execution, or authorize external transmission of sensitive information.

Official reference: https://docs.together.ai/docs/inference/openai-compatibility

## API service configuration (secrets in Railway only)

```dotenv
TOGETHER_API_KEY=<set securely in Railway, never commit>
TOGETHER_MODEL=<exact enabled Together model ID, e.g. MiniMaxAI/MiniMax-M3>
SEMSE_TOGETHER_ENABLED=false
LLM_DEFAULT_PROVIDER=ollama
```

- The key alone never registers or calls Together.
- A model must be selected explicitly; valid IDs and availability depend on the Together catalog/account.
- `SEMSE_TOGETHER_ENABLED=true` allows registration (and potential selection by the adaptive router). **Do not set it in production until review, tests, privacy approval, model/cost validation and bounded smoke.**
- No new HTTP endpoint is exposed; server-side SDK only. Never add the key to NEXT_PUBLIC variables, Web or client bundles.
- If Together is enabled, optional `LLM_FALLBACK_PROVIDERS` may include `together` (static routing). Do not change defaults without a review of routing behavior.
- To disable without removing the stored secret, set `SEMSE_TOGETHER_ENABLED=false`.

## Security and limitations

- Ollama remains the default. Requests marked `localOnly` or `privacyCritical` must never use Together (including fallbacks).
- Together is excluded from `TOOL_CAPABLE` and `RISK_SAFE`; the provider also denies `requiresTools`, tool payloads and `riskLevel=high` before any API call.
- The public provider is not certified for sensitive client contracts, original evidence, personal data or payment workflows in this slice. Data classifications and approved redaction must be enforced by the owning domain.
- Provider prices vary by model; estimated cost is `null` (unknown), not a fabricated price. Observe the vendor bill and usage before scaling.
- Scope of initial tests: registration/denial without network; no claim of a successful paid inference or authenticated production canary.
- Follow the approved `prometeo.model-gateway-unification` spec before making Together available via the other model gateway.

## Verification steps (staging only)

1. CI on exact commit: API build/typecheck + `provider-router.test.ts` + `together-provider.test.ts` + relevant integration/security tests.
2. Register with flag ON, dedicated key and a verified text-chat model in an isolated staging environment.
3. Execute a bounded, low-risk, non-sensitive text request. Confirm provider/model, response, latency, usage, failure handling, and actual billed cost.
4. Verify that localOnly/privacyCritical/high-risk/tool requests are denied or stay with permitted providers, including preferred-provider overrides and retries.
5. Turn the flag back OFF. Promote only after an independent review and explicit production rollout decision.
