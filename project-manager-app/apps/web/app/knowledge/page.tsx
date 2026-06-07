import { KnowledgeClient } from "./knowledge-client";
import { HtmlInCanvasPanel } from "@semse/ui";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Knowledge Hub · SEMSE"
};

export default function KnowledgePage() {
  return (
    <main className="mx-auto grid w-full max-w-7xl gap-6 px-6 py-8">
      <HtmlInCanvasPanel as="section" className="grid gap-2" canvasClassName="rounded-2xl" minHeight={110}>
        <span className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-muted">Unified Knowledge</span>
        <h1 className="text-3xl font-semibold tracking-tight text-ink">SEMSE Knowledge Hub</h1>
        <p className="max-w-3xl text-sm text-muted">
          Capa unificada para dominios maestros, servicios vivos y coordinacion del ecosistema inteligente.
        </p>
      </HtmlInCanvasPanel>
      <KnowledgeClient />
    </main>
  );
}
