"use client";

import { presignEvidence } from "../../semse-api";

/**
 * Sube un archivo real al storage compartido — mismo contrato de 3 pasos que
 * `uploadEvidenceFile` en semse-api.ts (presign → PUT al proxy BFF) — y
 * devuelve la URL servible (`GET /api/semse/uploads/files/:key`).
 *
 * No registra la evidencia: cada pantalla Agro ya tiene su propio paso de
 * alta (crear evidencia, reportar incidencia, verificar capacidad de un
 * trabajador) que solo necesita esta URL en su campo `fileUrl` existente.
 *
 * T-053: antes de esto, "URL del archivo" era texto libre en las 4 pantallas
 * que usan evidencia Agro — nadie subía nada, solo pegaba un enlace si lo
 * tenía (mismo patrón que RC2/2.45 en el resto del repo, ver skill
 * semse-upload-flow). WORKER ya tiene `evidence:write` (RBAC compartido de
 * contributor-program), así que no hace falta ningún permiso nuevo.
 */
export async function uploadAgroEvidenceFile(file: File): Promise<string> {
  const plan = await presignEvidence({
    filename: file.name,
    contentType: file.type || "application/octet-stream",
    fileSizeBytes: file.size,
    source: "local_device",
  });
  const key = typeof plan.key === "string" ? plan.key : "";
  if (!key) throw new Error("No se pudo preparar la subida del archivo.");

  const proxyPath = `/api/semse/uploads/files/${encodeURIComponent(key)}`;
  const res = await fetch(proxyPath, {
    method: "PUT",
    headers: {
      "content-type": file.type || "application/octet-stream",
      "content-length": String(file.size),
    },
    body: file,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `No se pudo subir "${file.name}" (${res.status}).`);
  }
  // AgroEvidenceItem.fileUrl valida como URL absoluta (Zod `.url()`); una ruta
  // relativa la rechaza — el controller no captura ese ZodError y responde 500
  // en vez de 400 (mismo hallazgo R8 del AS-IS). Se construye absoluta aquí.
  return `${window.location.origin}${proxyPath}`;
}
