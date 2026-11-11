/**
 * Job creation and attachment uploads are two distinct phases. The caller
 * must store the created Job ID before starting this step, otherwise a
 * transient upload failure could trigger an accidental duplicate Job POST.
 */
export const MAX_JOB_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export function validateJobAttachmentSelection(
  files: readonly Pick<File, "name" | "size">[],
): string | null {
  for (const file of files) {
    if (!file.name.trim() || !Number.isFinite(file.size) || file.size <= 0) {
      return "No se pueden adjuntar archivos vacíos o sin nombre.";
    }
    if (file.size > MAX_JOB_ATTACHMENT_BYTES) {
      return "Un archivo supera el límite de 10 MB. Retíralo o selecciona una versión más pequeña.";
    }
  }
  return null;
}

export async function uploadPendingJobAttachments<T>(
  files: readonly T[],
  jobId: string,
  completedIndices: Set<number>,
  upload: (file: T, jobId: string) => Promise<unknown>,
): Promise<void> {
  if (!jobId) throw new Error("Job ID is required before uploading attachments");
  for (let index = 0; index < files.length; index++) {
    if (completedIndices.has(index)) continue;
    // Advance only AFTER the canonical Evidence endpoint confirms registration.
    await upload(files[index], jobId);
    completedIndices.add(index);
  }
}
