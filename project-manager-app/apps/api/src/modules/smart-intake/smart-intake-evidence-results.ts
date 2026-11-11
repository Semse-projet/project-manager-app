/**
 * Intake image bytes may be uploaded before a Job has an operational Project.
 * A successful upload is NOT proof that a canonical Evidence record exists.
 * Only a fulfilled EvidenceService.register() result may advance this status.
 */
export function reconcileIntakeEvidenceResults<
  T extends { evidenceStatus: "draft" | "attached_to_job" },
>(
  images: readonly T[],
  registrations: readonly PromiseSettledResult<unknown>[],
): { images: T[]; attachedEvidenceCount: number; failedEvidence: number } {
  if (images.length !== registrations.length) {
    throw new Error("Evidence registration outcomes must match intake images");
  }

  const reconciled = images.map((image, index) => ({
    ...image,
    evidenceStatus: registrations[index].status === "fulfilled"
      ? "attached_to_job" as const
      : "draft" as const,
  })) as T[];

  const attachedEvidenceCount = reconciled.filter(
    image => image.evidenceStatus === "attached_to_job",
  ).length;

  return {
    images: reconciled,
    attachedEvidenceCount,
    failedEvidence: images.length - attachedEvidenceCount,
  };
}
