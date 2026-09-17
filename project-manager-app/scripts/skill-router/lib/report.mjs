// Shadow-mode discovery report (06_SHADOW_MODE_AND_OBSERVABILITY.md).
// Report-only: never throws, never fails a build; severities are informational.

const WARNING_SEVERITY = {
  ROOT_NOT_FOUND: "ERROR-IN-REPORT",
  ROOT_UNREADABLE: "ERROR-IN-REPORT",
  DUPLICATE_SKILL_ID: "ERROR-IN-REPORT",
  MALFORMED_FRONTMATTER: "WARNING",
  INVALID_METADATA: "WARNING",
  NO_FRONTMATTER: "WARNING",
  MISSING_SKILL_MD: "WARNING",
  SKILL_MD_UNREADABLE: "WARNING",
  FRONTMATTER_PARSE_WARNING: "WARNING",
  MISSING_ROUTING_METADATA: "INFO",
};

function severityOf(code) {
  return WARNING_SEVERITY[code] ?? "WARNING";
}

export function buildDiscoveryReport(registry, { roots } = {}) {
  const metadataCoverage = registry.skills.length === 0
    ? 0
    : registry.skills.filter((s) => s.hasRoutingMetadata).length / registry.skills.length;

  const invalidMetadata = registry.warnings.filter((w) => {
    const code = typeof w === "string" ? w.split(":")[0] : w.code;
    return code === "INVALID_METADATA" || code === "MALFORMED_FRONTMATTER";
  });

  const deprecated = registry.skills.filter((s) => s.routing.status === "deprecated").map((s) => s.id);

  return {
    skill_roots: roots ?? [],
    skill_count: registry.skills.length,
    duplicates: registry.duplicates ?? [],
    metadata_coverage: metadataCoverage,
    invalid_metadata_count: invalidMetadata.length,
    deprecated_skills: deprecated,
    warnings: registry.warnings.map((w) => {
      const code = typeof w === "string" ? "GENERIC" : w.code;
      const message = typeof w === "string" ? w : w.message;
      return { code, message, severity: severityOf(code) };
    }),
  };
}

export function renderDiscoveryReport(report) {
  const lines = [];
  lines.push("SEMSE Skill Router — discovery report (Phase 1, report-only)");
  lines.push(`  roots scanned:        ${report.skill_roots.join(", ") || "(none)"}`);
  lines.push(`  skills discovered:    ${report.skill_count}`);
  lines.push(`  metadata coverage:    ${(report.metadata_coverage * 100).toFixed(0)}% (skills with explicit routing: block)`);
  lines.push(`  duplicate skill ids:  ${report.duplicates.length}`);
  lines.push(`  invalid metadata:     ${report.invalid_metadata_count}`);
  lines.push(`  deprecated skills:    ${report.deprecated_skills.join(", ") || "(none)"}`);
  if (report.warnings.length > 0) {
    lines.push("  warnings:");
    for (const w of report.warnings) {
      lines.push(`    [${w.severity}] ${w.code}: ${w.message}`);
    }
  } else {
    lines.push("  warnings:             (none)");
  }
  lines.push("");
  lines.push("Report-only: no CI gate fails solely on this report's contents.");
  return lines.join("\n");
}

export function renderRouteDecision(decision) {
  const lines = [];
  lines.push(`SEMSE Skill Router — route ${decision.decision_id}`);
  lines.push(`  task fingerprint: ${decision.task_fingerprint}`);
  lines.push(`  phase:            ${decision.phase}`);
  lines.push(`  governance:       ${decision.governance.join(", ") || "(none)"}`);
  lines.push(`  execution:        ${decision.execution.join(", ") || "(none)"}`);
  lines.push(`  primary:          ${decision.primary ?? "(none — NO_CONFIDENT_DOMAIN_SKILL)"}`);
  lines.push(`  supporting:       ${decision.supporting.join(", ") || "(none)"}`);
  lines.push(`  confidence:       ${decision.confidence.toFixed(2)}`);
  lines.push("  reasons:");
  for (const r of decision.reasons) lines.push(`    - ${r}`);
  if (decision.warnings.length > 0) {
    lines.push("  warnings:");
    for (const w of decision.warnings) lines.push(`    - ${w}`);
  }
  if (decision.excluded.length > 0) {
    lines.push("  excluded (why not selected):");
    for (const e of decision.excluded) lines.push(`    - ${e.id}: ${e.reason}`);
  }
  lines.push("");
  lines.push("This is a recommendation only. It never grants authorization to mutate");
  lines.push("production, money, auth, or cross-tenant state — governance skills still apply.");
  return lines.join("\n");
}
