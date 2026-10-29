import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_JOB_ATTACHMENT_BYTES,
  uploadPendingJobAttachments,
  validateJobAttachmentSelection,
} from "../../apps/web/lib/job-publish-attachments.ts";

test("validates empty and oversized attachments before Job creation", () => {
  assert.equal(validateJobAttachmentSelection([{ name: "image.jpg", size: 4096 }]), null);
  assert.equal(validateJobAttachmentSelection([{ name: "empty.jpg", size: 0 }])?.includes("vacíos"), true);
  assert.equal(validateJobAttachmentSelection([{ name: "large.pdf", size: MAX_JOB_ATTACHMENT_BYTES + 1 }])?.includes("10 MB"), true);
  assert.equal(validateJobAttachmentSelection([{ name: " ", size: 100 }])?.includes("sin nombre"), true);
});

test("uploads each file against the existing Job ID exactly once", async () => {
  const calls: string[] = [];
  const complete = new Set<number>();
  await uploadPendingJobAttachments(["one.jpg", "two.pdf"], "job-01", complete, async (file, jobId) => {
    calls.push(`${jobId}:${file}`);
  });
  assert.deepEqual(calls, ["job-01:one.jpg", "job-01:two.pdf"]);
  assert.deepEqual([...complete], [0, 1]);
  await uploadPendingJobAttachments(["one.jpg", "two.pdf"], "job-01", complete, async () => {
    throw Error("already uploaded file must not be retried");
  });
});

test("failure leaves only unregistered items pending; retry never re-sends completed evidence", async () => {
  const complete = new Set<number>();
  const calls: string[] = [];
  let failures = 0;
  const upload = async (file: string) => {
    calls.push(file);
    if (file === "second.pdf" && failures++ === 0) throw Error("transient upload error");
  };
  await assert.rejects(uploadPendingJobAttachments(["first.jpg", "second.pdf"], "job-9", complete, upload), /transient/);
  assert.deepEqual([...complete], [0]);
  await uploadPendingJobAttachments(["first.jpg", "second.pdf"], "job-9", complete, upload);
  assert.deepEqual(calls, ["first.jpg", "second.pdf", "second.pdf"]);
  assert.deepEqual([...complete], [0, 1]);
});

test("an empty or missing Job ID cannot initiate a storage upload", async () => {
  let invoked = false;
  await assert.rejects(uploadPendingJobAttachments(["x"], "", new Set(), async () => { invoked = true; }), /Job ID/);
  assert.equal(invoked, false);
  await uploadPendingJobAttachments([], "job-1", new Set(), async () => { invoked = true; });
  assert.equal(invoked, false);
});
