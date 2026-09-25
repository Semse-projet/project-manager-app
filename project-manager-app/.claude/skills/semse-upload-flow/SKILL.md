---
name: semse-upload-flow
description: The canonical 3-step presigned-URL upload contract (plan → PUT to a BFF proxy → register) that fixed RC2 (the critical "files never actually upload" bug family, findings 0.34/2.1f/2.18/2.45), and the still-unsolved external_transfer/multipart gap for files over 25MB. Use before adding any new file-upload feature, or touching worker/evidence, worker/travel, or dispute evidence attachment.
---

# SEMSE file upload flow

## The canonical reference implementation

`apps/web/app/semse-api.ts` → `uploadEvidenceFile(file, jobId, milestoneId)` is the correct, already-fixed pattern. A second call site, `uploadPrometeoAttachment`, uses the identical shape — this is a real, repeated contract, not a one-off:

```text
1. presignEvidence({ filename, contentType, fileSizeBytes, source })
   → POST /api/semse/uploads/plan → { uploadUrl, key, recommendedStrategy }
2. PUT the real file to /api/semse/uploads/files/${key}
   (a BFF proxy route — NOT a direct PUT to the storage provider's uploadUrl
   from the browser; the proxy is what actually receives the bytes)
3. registerJobEvidence(jobId, { key, kind, milestoneId })
   → persists the evidence record, now pointing at a file that genuinely exists
```

`recommendedStrategy` from the plan step is currently only ever `"single_put"` or `"external_transfer"` — never `"multipart"`. Any `if (strategy === "multipart")` branch you find in older code was **dead code**, confirmed by the audit and deliberately deleted where found (see below) — don't resurrect it as a template for anything new.

## RC2 — what was actually broken, and why the fix looks this way

The root cause (findings `0.34`, `2.1f`) was that `worker/evidence`'s and `worker/travel/[travelId]`'s upload handlers called step 1 (get the plan) but **never called step 2** — no `fetch`/`PUT` to `plan.uploadUrl` anywhere in the `single_put` branch, so the presign succeeded (200) but zero bytes ever reached storage, and the evidence record referenced a key that didn't exist. The fix was to route both screens through the same `presign → PUT → register` shape now in `uploadEvidenceFile`.

Two related findings show the same anti-pattern to watch for elsewhere:
- **`2.18`**: even after files uploaded correctly, `EvidenceRepository`'s response mapper (`toEvidenceView`/`listByProject`/`findById`) was dropping the `validationStatus`/`aiQualityScore` fields from the response, so the UI's "Pendiente" badge never updated even though the AI validation had already run — a real upload succeeding is not the same as its result being visible; check the full read path too, not just the write path.
- **`2.45`**: the dispute-evidence "package" flow had **no real file input at all** — a free-text field for a "declared" filename/size, feeding a fake `external_transfer`/multipart session that never sent bytes but displayed "Sesión multipart completada." This was worse than `0.34` because there wasn't even a real file the user had chosen. Fixed by replacing it with a real `<input type="file">` wired to the same 3-step contract — **the fake multipart session code (`handleCompleteMultipart`, the `createMultipartUploadSession`/`uploadMultipartPart`/`completeMultipartUploadSession` imports, `MultipartSessionView`) was deleted entirely**, not kept as a fallback.

## `external_transfer` / multipart — UPDATE: this gap was closed (PR-4, 2026-09-17), don't re-delete it

**Correction to this skill's own earlier claim.** This section originally said there was "no real upload path for `external_transfer` anywhere in this repo" and that the right fix for a fake multipart flow was to delete it entirely, deferring real large-file upload to a future spec. That was true when this skill was written, but is **no longer true** — a later session (PR-4, `docs/reportes/pr4_local_recording_offline_sync_zoom_2026-09-17.md`) found and fixed the actual bug: the multipart-session endpoints (`POST /v1/uploads/multipart-session`, `PUT .../parts/:partNumber`, `POST .../complete`) existed and looked complete but never wrote any uploaded bytes to disk and never assembled a final file — the same "false success" shape as `0.34`, just deeper in the stack (API, not just the UI). That session fixed it to actually persist/reassemble parts (with tenant isolation and etag verification added too — see `apps/api/src/modules/evidence/evidence.controller.ts` and `apps/api/test/multipart-upload.test.ts`, 5 tests against real file I/O), and wired the real end-user surface (contributor `ClipUploader`, `apps/web/app/contributors/dashboard/submissions/[acceptanceId]/page.tsx`) to use it for clips over the single-PUT threshold.

**Do not delete or bypass this path** thinking you're completing the `2.45`-style cleanup described below — check `git blame`/`git log` on the multipart handlers first if you're about to touch them; the PR-4 report has the full trace. If you find a *new* screen that still fakes multipart success (fabricated etags, no real file input), the right fix now is to wire it to the real, working multipart client functions (`createMultipartUploadSession`/`uploadMultipartPart`/`completeMultipartUploadSession` in `apps/web/app/semse-api.ts`, which take a real `Blob` and return real server-verified etags) — not to delete the call and give up on large files, and not to re-fabricate etags.

## Notas para futuros agentes / hallazgos abiertos

- No se identificó todavía un formulario separado de "referencia manual de evidencia" (key tecleada a mano, mencionado en el hallazgo `2.45`) como parte de este mismo contrato — es una feature distinta que ya es honesta sobre no subir nada, solo referenciar una key existente. No lo confundas con el flujo de 3 pasos de arriba.
- No se auditaron todos los call sites de `presignEvidence`/`planUpload` en el repo — `uploadEvidenceFile` y `uploadPrometeoAttachment` son los dos confirmados en la sesión original de esta skill. Si aparece un tercer flujo de subida, confirmar que sigue el mismo patrón de 3 pasos antes de asumirlo, en vez de copiarlo a ciegas de acá.
- El hueco de `external_transfer` **ya se cerró** (ver sección de arriba) — no repitas el trabajo ni lo trates como diseño pendiente. Lo que sí sigue sin auditar: si hay un tercer/cuarto call site de multipart además de `admin/disputes` y `jobs/[jobId]/evidence` (los dos confirmados en la sesión de PR-4), ni si el mismo patrón de reensamblado real se necesita en algún flujo de audio/transcript futuro (PR-5 en adelante).
