import { ExternalLink } from "lucide-react";
import { ContextBridgePanel } from "../../../../components/admin/context-bridge-panel";
import { ModuleShell } from "../../../../components/admin/module-shell";
import { getAdminModuleById } from "../../../../lib/admin/admin-navigation";

const tools = [
  { name: "ChatGPT", type: "AI Assistant", status: "External" },
  { name: "Claude", type: "AI Assistant", status: "External" },
  { name: "Codex", type: "Coding Agent", status: "Active" },
  { name: "Gemini", type: "AI Assistant", status: "External" },
  { name: "Notion", type: "Knowledge Base", status: "Planned" },
  { name: "Figma", type: "Design", status: "Planned" },
  { name: "GitHub", type: "Source Control", status: "Connected" },
  { name: "Railway", type: "Deployments", status: "Connected" },
  { name: "n8n", type: "Automation", status: "Planned" },
];

export default function ToolHubPage() {
  const module = getAdminModuleById("tool-hub");

  if (!module) return null;

  return (
    <ModuleShell module={module}>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {tools.map((tool) => (
            <article key={tool.name} className="rounded-lg border border-white/[0.08] bg-[#101527] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-ink">{tool.name}</h2>
                  <p className="mt-1 text-sm text-muted">{tool.type}</p>
                </div>
                <span className="rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-1 text-[0.68rem] font-semibold uppercase tracking-widest text-muted">
                  {tool.status}
                </span>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="inline-flex min-h-9 items-center gap-2 rounded-md border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-sm font-semibold text-ink"
                >
                  <ExternalLink size={15} />
                  Open
                </button>
                <button
                  type="button"
                  className="inline-flex min-h-9 items-center rounded-md border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-sm font-semibold text-ink"
                >
                  Copy context
                </button>
              </div>
            </article>
          ))}
        </section>
        <ContextBridgePanel />
      </div>
    </ModuleShell>
  );
}
