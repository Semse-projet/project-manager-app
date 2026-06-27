"use client";

import { useMemo, useState } from "react";
import { Check, Copy, ExternalLink, GitBranch } from "lucide-react";

const DEFAULT_PROMPT = [
  "Project: SEMSEproject",
  "Active area: Admin modular ecosystem",
  "Goal: continue the frontend-safe modular restructure",
  "Constraints: keep legacy routes, do not touch backend, Prisma, or Railway",
  "Next step: implement one small hub or navigation change and validate TypeScript",
].join("\n");

export function ContextBridgePanel({
  project = "SEMSEproject",
  branch = "main",
  deploy = "Production",
  goal = "Modular Admin ecosystem restructure",
  prompt = DEFAULT_PROMPT,
  bridgeCopied,
  onCopy,
}: {
  project?: string;
  branch?: string;
  deploy?: string;
  goal?: string;
  prompt?: string;
  bridgeCopied?: boolean;
  onCopy?: () => void;
}) {
  const [internalCopied, setInternalCopied] = useState(false);

  const copied = bridgeCopied ?? internalCopied;

  const context = useMemo(
    () =>
      [
        `Project: ${project}`,
        `Active branch: ${branch}`,
        `Latest deploy: ${deploy}`,
        `Current goal: ${goal}`,
        "",
        "Suggested prompt:",
        prompt,
      ].join("\n"),
    [branch, deploy, goal, project, prompt],
  );

  async function copyContext() {
    if (onCopy) {
      onCopy();
      return;
    }
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(context);
    }
    setInternalCopied(true);
    window.setTimeout(() => setInternalCopied(false), 1600);
  }

  return (
    <aside
      style={{
        borderRadius: 12,
        border: "1px solid var(--border)",
        background: "#0d1222",
        padding: 20,
        height: "fit-content",
        position: "sticky",
        top: 24,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--brand, #8ab4f8)" }}>
            Context Bridge
          </h2>
          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4, lineHeight: 1.5 }}>
            Portable context for AI tools and operator handoff.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void copyContext()}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "7px 12px",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: copied ? "rgba(110,231,183,.08)" : "var(--surface)",
            color: copied ? "#6ee7b7" : "var(--ink)",
            fontSize: 13, fontWeight: 600,
            cursor: "pointer",
            flexShrink: 0,
            transition: "all 0.15s",
          }}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>

      <dl style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
        {[
          { key: "Project", value: project },
          { key: "Branch", value: branch },
          { key: "Deploy", value: deploy },
          { key: "Goal", value: goal },
          { key: "Guardrail", value: "No backend · No Prisma · No Railway" },
        ].map(({ key, value }) => (
          <div
            key={key}
            style={{
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,.07)",
              background: "rgba(255,255,255,.03)",
              padding: "8px 12px",
            }}
          >
            <dt style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--faint)" }}>
              {key}
            </dt>
            <dd style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginTop: 2 }}>{value}</dd>
          </div>
        ))}
      </dl>

      <div
        style={{
          borderRadius: 8,
          border: "1px solid rgba(255,255,255,.07)",
          background: "rgba(255,255,255,.02)",
          padding: "10px 12px",
          marginBottom: 16,
        }}
      >
        <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--faint)", marginBottom: 6 }}>
          Suggested Prompt
        </p>
        <pre style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0 }}>
          {prompt}
        </pre>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <a
          href="https://github.com/Semse-projet/project-manager-app"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            flex: 1,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--surface)",
            color: "var(--muted)",
            fontSize: 12, fontWeight: 600,
            textDecoration: "none",
          }}
        >
          <GitBranch size={13} />
          GitHub
        </a>
        <a
          href="https://railway.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            flex: 1,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--surface)",
            color: "var(--muted)",
            fontSize: 12, fontWeight: 600,
            textDecoration: "none",
          }}
        >
          <ExternalLink size={13} />
          Railway
        </a>
      </div>
    </aside>
  );
}
