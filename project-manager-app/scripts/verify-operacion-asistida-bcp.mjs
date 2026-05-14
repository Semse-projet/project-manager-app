import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();

const requiredDocuments = [
  {
    path: "docs/bcp/BCP_OVERVIEW.md",
    requiredText: [
      "RTO: 4h",
      "RPO: 15m",
      "OPERACION_ASISTIDA_BACKUP_RECOVERY_RUNBOOK.md",
      "backup_recovery"
    ]
  },
  {
    path: "docs/bcp/README.md",
    requiredText: [
      "BCP",
      "verify:operacion-asistida:bcp",
      "verify:operacion-asistida:local",
      "verify:operacion-asistida:api-local",
      "verify:operacion-asistida:dedicated-store",
      "verify:operacion-asistida:module",
      "drill:operacion-asistida:bcp",
      "drill:operacion-asistida:api-local",
      "review:operacion-asistida:risk",
      "review:operacion-asistida:governance",
      "drill:operacion-asistida:restore",
      "drill:operacion-asistida:restore:multienv",
      "audit:operacion-asistida:workspace-memory-legacy",
      "SEMSE_BCP_DRILL_MODE=api",
      "manifest.json",
      "runtime activo"
    ]
  },
  {
    path: "docs/bcp/OPERACION_ASISTIDA_BACKUP_RECOVERY_RUNBOOK.md",
    requiredText: [
      "Condiciones de activacion",
      "Fuentes canonicas",
      "Procedimiento",
      "Criterios de exito",
      "Evidencia requerida",
      "drill:operacion-asistida:bcp",
      "drill:operacion-asistida:api-local",
      "verify:operacion-asistida:local",
      "verify:operacion-asistida:api-local",
      "verify:operacion-asistida:dedicated-store",
      "verify:operacion-asistida:module",
      "SEMSE_BCP_DRILL_MODE=api",
      "review:operacion-asistida:risk",
      "review:operacion-asistida:governance",
      "drill:operacion-asistida:restore",
      "drill:operacion-asistida:restore:multienv",
      "audit:operacion-asistida:workspace-memory-legacy",
      "manifest.json",
      "workspace_memory",
      "operatorContext",
      "AgentRun",
      "AuditLog"
    ]
  },
  {
    path: "docs/bcp/OPERACION_ASISTIDA_RECOVERY_CHECKLIST.md",
    requiredText: [
      "Restore",
      "Operacion asistida",
      "Auditoria",
      "Validacion",
      "drill:operacion-asistida:bcp",
      "SEMSE_BCP_DRILL_MODE=api",
      "pnpm smoke:operacion-asistida"
    ]
  },
  {
    path: "docs/foundation/OPERACION_ASISTIDA_TO_MONOREPO_MAPPING.md",
    requiredText: [
      "backup_recovery",
      "verify:operacion-asistida:bcp"
    ]
  }
];

async function main() {
  for (const document of requiredDocuments) {
    const content = await readFile(join(root, document.path), "utf8");

    for (const text of document.requiredText) {
      assert.ok(
        content.includes(text),
        `${document.path} must include required marker: ${text}`
      );
    }
  }

  console.log("[verify:operacion-asistida:bcp] success", {
    documents: requiredDocuments.map((document) => document.path)
  });
}

main().catch((error) => {
  console.error("[verify:operacion-asistida:bcp] failed", error);
  process.exit(1);
});
