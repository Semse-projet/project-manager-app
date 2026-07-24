import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "../..");

function read(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("client job detail routes funding and release through explicit confirmation modals", () => {
  const source = read("apps/web/app/(app)/client/jobs/[jobId]/page.tsx");

  assert.match(source, /<EscrowFundModal/);
  assert.match(source, /onClick=\{\(\) => setFundModalOpen\(true\)\}/);
  assert.doesNotMatch(source, /\bfundJobEscrow\b/);

  assert.match(source, /<EscrowReleaseModal/);
  assert.match(source, /amount=\{releaseCandidate\.amount\}/);
  assert.match(source, /onConfirm=\{\(\) => confirmRelease\(releaseCandidate\.id\)\}/);
  assert.doesNotMatch(source, /onClick=\{\(\) => void confirmRelease\(/);
});

test("legacy escrow surface only requests release from the timeline and confirms in the page", () => {
  const pageSource = read("apps/web/app/jobs/[jobId]/escrow/page.tsx");
  const timelineSource = read("packages/ui/src/components/EscrowTimeline.tsx");

  assert.match(pageSource, /<EscrowFundModal/);
  assert.doesNotMatch(pageSource, /\bfundJobEscrow\b/);
  assert.match(pageSource, /onReleaseMilestone=\{handleRequestReleaseMilestone\}/);
  assert.match(pageSource, /<EscrowReleaseModal/);
  assert.match(pageSource, /onConfirm=\{\(\) => confirmReleaseMilestone\(releaseCandidate\.id\)\}/);

  assert.match(timelineSource, /onReleaseMilestone\?: \(milestoneId: string\) => void/);
  assert.match(timelineSource, /formatCurrency\(milestone\.amount, currency\)/);
  assert.match(timelineSource, /onClick=\{\(\) => onRelease\(milestone\.id\)\}/);

  const releaseModalSource = read("apps/web/app/components/payments/EscrowReleaseModal.tsx");
  assert.match(releaseModalSource, /const hasValidAmount = Number\.isFinite\(amount\) && amount > 0/);
  assert.match(releaseModalSource, /disabled=\{submitting \|\| !hasValidAmount\}/);
});

test("legacy job dispute settlement makes the permitted outcome and acknowledgement explicit", () => {
  const pageSource = read("apps/web/app/jobs/[jobId]/page.tsx");
  const clientDisputesSource = read("apps/web/app/(app)/client/disputes/page.tsx");
  const modalSource = read("apps/web/app/components/disputes/DisputeResolutionModal.tsx");

  assert.match(pageSource, /<DisputeResolutionModal/);
  assert.match(pageSource, /confirmResolveDispute\(resolutionCandidate\.id, resolution, resolutionType\)/);
  assert.doesNotMatch(pageSource, /Resolved by client in favor of the professional/);

  assert.match(clientDisputesSource, /<DisputeResolutionModal/);
  assert.match(clientDisputesSource, /requestResolveDispute\(item\.id\)/);
  assert.match(clientDisputesSource, /confirmResolveDispute\(resolutionCandidate\.id, resolution, resolutionType\)/);
  assert.doesNotMatch(clientDisputesSource, /onClick=\{\(\) => void confirmResolveDispute\(/);

  assert.match(modalSource, /"pro_favor"/);
  assert.match(modalSource, /data-testid="dispute-resolution-outcome"/);
  assert.match(modalSource, /data-testid="dispute-resolution-acknowledgement"/);
  assert.match(modalSource, /disabled=\{!acknowledged \|\| !resolution\.trim\(\) \|\| submitting\}/);
});

test("legacy jobs pages require a signed session and stay reachable for every role", () => {
  const middlewareSource = read("apps/web/middleware.ts");

  assert.match(middlewareSource, /PROTECTED_PREFIXES = \[[^\]]*"\/jobs"/);
  assert.match(middlewareSource, /client: \[[^\]]*"\/jobs"/);
  assert.match(middlewareSource, /admin:\s+\[[^\]]*"\/jobs"/);
  // The worker tracker links to /jobs/:id and /jobs/:id/escrow, so the worker
  // role keeps access (session still required).
  assert.match(middlewareSource, /worker: \[[^\]]*"\/jobs"/);
});
