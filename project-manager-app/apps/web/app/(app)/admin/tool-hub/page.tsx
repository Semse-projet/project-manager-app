"use client";

import { ExternalLink, Copy, Check } from "lucide-react";
import { useState } from "react";
import { ContextBridgePanel } from "../../../../components/admin/context-bridge-panel";
import { ModuleShell } from "../../../../components/admin/module-shell";
import { getAdminModuleById } from "../../../../lib/admin/admin-navigation";

const CONTEXT_PROMPT = [
  "You are working on SEMSEproject.",
  "Repository: Semse-projet/project-manager-app",
  "Root: project-manager-app/",
  "Frontend: apps/web/",
  "Backend: apps/api/ (NestJS)",
  "Target: apps/web/app/(app)/admin/",
  "Goal: apply modular admin ecosystem navigation without breaking production.",
  "Constraints: do not change backend, Prisma, Railway, or database migrations in this phase.",
  "Preserve legacy routes and create module hubs for Mission Control, WorkOps, Intelligence, Tool Hub, and Verticals.",
  "Validate TypeScript and web build before finalizing.",
].join("\n");

const TOOLS = [
  {
    name: "ChatGPT",
    type: "AI Assistant",
    status: "External",
    statusColor: "#94a3b8",
    color: "#10a37f",
    bg: "rgba(16,163,127,.1)",
    letter: "G",
    url: "https://chat.openai.com",
  },
  {
    name: "Claude",
    type: "AI Assistant",
    status: "Active",
    statusColor: "#6ee7b7",
    color: "#d97757",
    bg: "rgba(217,119,87,.1)",
    letter: "C",
    url: "https://claude.ai",
  },
  {
    name: "Codex",
    type: "Coding Agent",
    status: "Active",
    statusColor: "#6ee7b7",
    color: "#8ab4f8",
    bg: "rgba(138,180,248,.1)",
    letter: "X",
    url: "https://chatgpt.com/codex",
  },
  {
    name: "Gemini",
    type: "AI Assistant",
    status: "External",
    statusColor: "#94a3b8",
    color: "#4285f4",
    bg: "rgba(66,133,244,.1)",
    letter: "G",
    url: "https://gemini.google.com",
  },
  {
    name: "Notion",
    type: "Knowledge Base",
    status: "Planned",
    statusColor: "#fcd34d",
    color: "#ffffff",
    bg: "rgba(255,255,255,.06)",
    letter: "N",
    url: "https://notion.so",
  },
  {
    name: "Figma",
    type: "Design Tool",
    status: "Planned",
    statusColor: "#fcd34d",
    color: "#f24e1e",
    bg: "rgba(242,78,30,.1)",
    letter: "F",
    url: "https://figma.com",
  },
  {
    name: "GitHub",
    type: "Source Control",
    status: "Connected",
    statusColor: "#6ee7b7",
    color: "#e2e8f0",
    bg: "rgba(226,232,240,.06)",
    letter: "G",
    url: "https://github.com/Semse-projet/project-manager-app",
  },
  {
    name: "Railway",
    type: "Deployments",
    status: "Connected",
    statusColor: "#6ee7b7",
    color: "#a855f7",
    bg: "rgba(168,85,247,.1)",
    letter: "R",
    url: "https://railway.com",
  },
  {
    name: "n8n",
    type: "Automation",
    status: "Planned",
    statusColor: "#fcd34d",
    color: "#ea5b31",
    bg: "rgba(234,91,49,.1)",
    letter: "n",
    url: "https://n8n.io",
  },
];

function ToolCard({ tool, onCopyContext }: { tool: (typeof TOOLS)[0]; onCopyContext: () => void }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    onCopyContext();
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <article
      style={{
        borderRadius: 12,
        border: "1px solid var(--border)",
        borderTop: `3px solid ${tool.color}`,
        background: tool.bg,
        padding: "18px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 9,
            background: tool.bg,
            border: `1px solid ${tool.color}40`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, fontWeight: 800, color: tool.color,
            flexShrink: 0,
          }}>
            {tool.letter}
          </div>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", lineHeight: 1.2 }}>{tool.name}</h2>
            <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{tool.type}</p>
          </div>
        </div>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: "0.07em",
          textTransform: "uppercase",
          color: tool.statusColor,
          background: `${tool.statusColor}18`,
          padding: "3px 8px", borderRadius: 6,
          border: `1px solid ${tool.statusColor}30`,
          flexShrink: 0,
        }}>
          {tool.status}
        </span>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <a
          href={tool.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            flex: 1,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--surface)",
            color: "var(--ink)",
            fontSize: 13, fontWeight: 600,
            textDecoration: "none",
            transition: "border-color 0.15s",
          }}
        >
          <ExternalLink size={13} />
          Open
        </a>
        <button
          type="button"
          onClick={() => void handleCopy()}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--surface)",
            color: copied ? "#6ee7b7" : "var(--muted)",
            fontSize: 13, fontWeight: 600,
            cursor: "pointer",
            transition: "color 0.15s",
          }}
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? "Copied!" : "Copy ctx"}
        </button>
      </div>
    </article>
  );
}

export default function ToolHubPage() {
  const mod = getAdminModuleById("tool-hub");
  const [bridgeCopied, setBridgeCopied] = useState(false);

  if (!mod) return null;

  async function copyContext() {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(CONTEXT_PROMPT);
    }
    setBridgeCopied(true);
    setTimeout(() => setBridgeCopied(false), 1500);
  }

  return (
    <ModuleShell module={mod} eyebrow="SEMSE Tool Hub">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {TOOLS.map((tool) => (
            <ToolCard key={tool.name} tool={tool} onCopyContext={() => void copyContext()} />
          ))}
        </section>
        <ContextBridgePanel
          prompt={CONTEXT_PROMPT}
          bridgeCopied={bridgeCopied}
          onCopy={() => void copyContext()}
        />
      </div>
    </ModuleShell>
  );
}
